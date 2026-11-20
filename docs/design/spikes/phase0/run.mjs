// Phase 0 spikes. Run from the repository root after `npm run build`:
//   node docs/design/spikes/phase0/run.mjs
// Builds a small consumer app, opens it in Chromium and reports what worked. Scratch output goes
// to `.temp/spikes/` (git-ignored). Needs Playwright with Chromium installed (not a repo dependency). See ../../vanilla-and-element.md for what the results mean.
import { createServer } from 'node:http';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

// Playwright is not a dependency of this repository: use the copy that is installed on the machine.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const scratch = join(root, '.temp', 'spikes');
const appDir = join(root, 'docs/design/spikes/phase0/app');
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

/**
 * The CSS-delivery proposal: next to `style.css`, the build also emits `style.css.js`, a module
 * whose default export is the CSS text. The `/element` entry adopts it into its shadow root, so
 * nobody has to import a stylesheet.
 */
const cssAsModule = {
  name: 'emit-css-as-module',
  enforce: 'post',
  // `post`: Vite writes style.css in its own generateBundle step, which has to run first.
  generateBundle: {
    order: 'post',
    handler(_options, bundle) {
      const css = bundle['style.css'];
      if (css?.type === 'asset') {
        this.emitFile({
          type: 'asset',
          fileName: 'style.css.js',
          source: `export default ${JSON.stringify(String(css.source))};\n`,
        });
      }
    },
  },
};

// A. Build the real markdown package once more with the CSS-as-module plugin added. ---------------
const markdownDir = join(root, 'packages/fovea-markdown');
const markdownOut = join(scratch, 'markdown-dist');
await build({
  root: markdownDir,
  configFile: join(markdownDir, 'vite.config.js'),
  logLevel: 'silent',
  plugins: [cssAsModule],
  build: { outDir: markdownOut, emptyOutDir: true, sourcemap: false },
});
const emitted = existsSync(join(markdownOut, 'style.css.js'));
record(
  'build: CSS-as-module (style.css.js) is emitted next to style.css',
  emitted && existsSync(join(markdownOut, 'style.css')),
  emitted ? `${readFileSync(join(markdownOut, 'style.css.js')).length} bytes` : 'missing',
);

// B. A second entry (a stand-in for /vanilla) shares pdfjs.js and its worker. --------------------
const pdfDir = join(root, 'packages/fovea-pdf');
const stand = join(pdfDir, 'src/__spike_vanilla.js');
const pdfOut = join(scratch, 'pdf-dist');
try {
  writeFileSync(stand, "export { loadPdfjs } from './pdfjs.js';\n");
  const config = (await import(join(pdfDir, 'vite.config.js'))).default;
  config.build.lib.entry = { index: 'src/index.js', vanilla: 'src/__spike_vanilla.js' };
  await build({
    ...config,
    root: pdfDir,
    configFile: false,
    logLevel: 'silent',
    build: { ...config.build, outDir: pdfOut, emptyOutDir: true, sourcemap: false },
  });
} finally {
  rmSync(stand, { force: true });
}
const vanillaChunk = readFileSync(join(pdfOut, 'vanilla.js'), 'utf8');
const pdfjsChunk = readFileSync(join(pdfOut, 'pdfjs.js'), 'utf8');
record(
  'build: a second pdf entry re-uses pdfjs.js (one worker, one loader)',
  /from ['"]\.\/pdfjs\.js['"]/.test(vanillaChunk) &&
    existsSync(join(pdfOut, 'pdf.worker.min.mjs')) &&
    /new URL\("\.\/pdf\.worker\.min\.mjs", import\.meta\.url\)/.test(pdfjsChunk),
  'vanilla.js imports ./pdfjs.js; worker emitted once beside it',
);
record(
  'build: the stand-in vanilla entry does not import React',
  !/react/.test(vanillaChunk),
  'entry chunk text contains no "react"',
);

// C. jsdom (the unit-test environment) lacks constructable stylesheets. ---------------------------
const { window } = new JSDOM('<div id="h"></div>');
const shadow = window.document.getElementById('h').attachShadow({ mode: 'open' });
record(
  'jsdom: attachShadow works, adoptedStyleSheets does not (needs a <style> fallback)',
  typeof shadow.querySelector === 'function' && !('adoptedStyleSheets' in shadow),
  `CSSStyleSheet constructable: ${typeof window.CSSStyleSheet === 'function' && 'replaceSync' in window.CSSStyleSheet.prototype}`,
);

// D. The browser spikes, against a built consumer app. -------------------------------------------
const appOut = join(scratch, 'app-dist');
await build({
  root: appDir,
  configFile: false,
  logLevel: 'silent',
  plugins: [react()],
  publicDir: join(root, 'examples/demo/public/samples'),
  resolve: { alias: { '@spike/markdown-css': join(markdownOut, 'style.css.js') } },
  build: { outDir: appOut, emptyOutDir: true },
});

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.pdf': 'application/pdf',
};
const server = createServer((req, res) => {
  const path = join(appOut, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = path.endsWith('/') ? join(path, 'index.html') : path;
  if (!file.startsWith(appOut) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const { port } = server.address();

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  const browserResults = await page.evaluate(() => window.runSpikes());
  for (const r of browserResults) record(r.name, r.ok, r.detail);
  if (errors.length) record('browser: no uncaught page errors', false, errors.join(' | '));
} finally {
  await browser.close();
  server.close();
}

// Report ---------------------------------------------------------------------------------------
mkdirSync(scratch, { recursive: true });
writeFileSync(join(scratch, 'results.json'), JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
