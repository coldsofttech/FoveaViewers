import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import emitCssModule from './vite-plugin-css-module.js';

const dirs = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Builds a one-file library, with or without CSS, with the plugin. */
async function buildFixture({ css, plugin = emitCssModule() }) {
  const root = mkdtempSync(join(tmpdir(), 'fovea-css-'));
  dirs.push(root);
  mkdirSync(join(root, 'src'));
  // Vite names a library's stylesheet after the package.
  writeFileSync(join(root, 'package.json'), '{"name":"fixture"}');
  if (css) {
    writeFileSync(join(root, 'src/a.module.css'), css);
    writeFileSync(join(root, 'src/index.js'), "import s from './a.module.css'; export default s;");
  } else {
    writeFileSync(join(root, 'src/index.js'), 'export default 1;');
  }
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [plugin],
    build: {
      lib: { entry: 'src/index.js', formats: ['es'] },
      cssCodeSplit: false,
      rollupOptions: { output: { assetFileNames: 'style.css' } },
    },
  });
  return root;
}

describe('emitCssModule', () => {
  it('emits style.css.js whose default export is the CSS of style.css', async () => {
    const root = await buildFixture({ css: '.root { color: red; }\n.other { top: 0; }' });
    const sheet = readFileSync(join(root, 'dist/style.css'), 'utf8');
    const module = readFileSync(join(root, 'dist/style.css.js'), 'utf8');
    expect(module).toBe(`export default ${JSON.stringify(sheet)};\n`);
    expect(sheet).toContain('color:red');
    const text = (await import(`data:text/javascript,${encodeURIComponent(module)}`)).default;
    expect(text).toBe(sheet);
  });

  it('fails the build when there is no stylesheet to turn into a module', async () => {
    await expect(buildFixture({ css: null })).rejects.toThrow(/no "style\.css"/);
  });
});
