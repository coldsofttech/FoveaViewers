import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import cssModule from './vite-plugin-css-module.js';

const dirs = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Builds a small library the way a viewer package is built: CSS modules, a stub `style.css.js`,
 * and an `element.js` that imports the stub.
 */
async function buildFixture({
  css = '.root { color: red; }\n.other { top: 0; }',
  element = true,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fovea-css-'));
  dirs.push(root);
  mkdirSync(join(root, 'src'));
  // Vite names a library's stylesheet after the package, and a `type: module` package gets .js files.
  writeFileSync(join(root, 'package.json'), '{"name":"fixture","type":"module"}');
  writeFileSync(join(root, 'src/style.css.js'), "export default '';\n");
  const entry = { index: 'src/index.js' };
  if (css) {
    writeFileSync(join(root, 'src/a.module.css'), css);
    writeFileSync(join(root, 'src/index.js'), "import s from './a.module.css'; export default s;");
  } else {
    writeFileSync(join(root, 'src/index.js'), 'export default 1;');
  }
  if (element) {
    writeFileSync(
      join(root, 'src/element.js'),
      "import css from './style.css.js'; export default css;",
    );
    entry.element = 'src/element.js';
  }
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [cssModule()],
    build: {
      lib: { entry, formats: ['es'] },
      cssCodeSplit: false,
      rollupOptions: {
        output: { preserveModules: true, preserveModulesRoot: 'src', assetFileNames: 'style.css' },
      },
    },
  });
  return root;
}

/** The default export of every built file that mentions the CSS, evaluated. */
const evaluate = async (code) =>
  (await import(`data:text/javascript,${encodeURIComponent(code)}`)).default;

describe('cssModule', () => {
  it('puts the text of style.css where the element imports the stub', async () => {
    const root = await buildFixture();
    const sheet = readFileSync(join(root, 'dist/style.css'), 'utf8');
    expect(sheet).toContain('color:red');
    // The bundler may inline the stub's constant into the element or keep it as its own file.
    const element = readFileSync(join(root, 'dist/element.js'), 'utf8');
    const text = /from ['"]\.\/style\.css\.js['"]/.test(element)
      ? readFileSync(join(root, 'dist/style.css.js'), 'utf8')
      : element;
    expect(text).not.toContain('PLACEHOLDER');
    expect(await evaluate(text)).toBe(sheet);
  });

  it('fails the build when there is no stylesheet to put in', async () => {
    await expect(buildFixture({ css: null })).rejects.toThrow(/no "style\.css"/);
  });

  it('fails the build when nothing imports the stub', async () => {
    await expect(buildFixture({ element: false })).rejects.toThrow(
      /nothing imports "style\.css\.js"/,
    );
  });
});
