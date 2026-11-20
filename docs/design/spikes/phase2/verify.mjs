// Phase 2 check in a real browser. Run from the repository root after `npm run build`:
//   node docs/design/spikes/phase2/verify.mjs
// Builds examples/vanilla (an app with no React), opens it in Chromium and drives the built text
// and image viewers, as Web Components and as plain functions. Needs Playwright with Chromium (not
// a repository dependency).
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const app = join(root, 'examples/vanilla');
const dist = join(app, 'dist');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

await build({ root: app, logLevel: 'silent' });

// No React anywhere in what the app ships.
const MARKERS = [
  '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED',
  'react.production',
  'react-dom.production',
];
const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
const bundled = assets.filter((f) =>
  MARKERS.some((m) => readFileSync(join(dist, 'assets', f), 'utf8').includes(m)),
);
check('bundle: the app ships no React', bundled.length === 0, `${assets.length} script(s) checked`);

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.txt': 'text/plain',
};
const server = createServer((req, res) => {
  const path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = path.endsWith('/') ? join(path, 'index.html') : path;
  if (!file.startsWith(dist) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);

  const run = (fn, arg) => page.evaluate(fn, arg);

  // Web Components ---------------------------------------------------------------------------
  await page.waitForFunction(() =>
    document.querySelector('#text')?.shadowRoot?.querySelector('[data-line="1"]'),
  );
  const text = await run(() => {
    const root = document.querySelector('#text').shadowRoot.querySelector('[data-fovea-root]');
    return {
      registered: Boolean(customElements.get('fovea-text') && customElements.get('fovea-image')),
      scrolls: getComputedStyle(root).overflowY,
      mono: getComputedStyle(root).fontFamily.includes('mono'),
      pageStyleLeak: Boolean(document.querySelector('style[data-fovea]')),
    };
  });
  check(
    'element: <fovea-text> and <fovea-image> are registered by importing /element',
    text.registered,
  );
  check(
    'element: the CSS reached the shadow root (scrolling, monospace)',
    text.scrolls === 'auto' && text.mono,
    JSON.stringify(text),
  );

  await page.waitForFunction(
    () => document.querySelector('#image')?.shadowRoot?.querySelector('img')?.naturalWidth > 0,
  );
  const image = await run(async () => {
    const root = document.querySelector('#image').shadowRoot.querySelector('[data-fovea-root]');
    const zoom = () => root.querySelector('[role="toolbar"] span').textContent;
    const before = zoom();
    root.querySelector('[aria-label="Zoom in"]').click();
    await new Promise((r) => setTimeout(r, 50));
    const img = root.querySelector('img');
    root.querySelector('[aria-label="Rotate right"]').click();
    await new Promise((r) => setTimeout(r, 50));
    return {
      before,
      after: zoom(),
      rotated: img.style.transform.includes('rotate(90deg)'),
      info: root.querySelector('p')?.textContent,
      toolbar: getComputedStyle(root.querySelector('[role="toolbar"]')).display,
    };
  });
  check(
    'element: <fovea-image> loads, zooms and rotates',
    image.before !== image.after && image.rotated,
    JSON.stringify(image),
  );
  check('element: the image viewer is laid out (toolbar is a flex row)', image.toolbar === 'flex');

  // A big file through the property, with a target ---------------------------------------------
  const big = await run(async () => {
    const el = document.querySelector('#text');
    const lines = Array.from({ length: 50_000 }, (_, i) => `line ${i + 1} some words here`).join(
      '\n',
    );
    const ready = new Promise((r) =>
      el.addEventListener('fovea-ready', (e) => r(e.detail), { once: true }),
    );
    el.target = { line: 25000, column: 6, length: 5 };
    el.source = new Blob([lines]);
    const detail = await ready;
    await new Promise((r) => setTimeout(r, 200));
    const root = el.shadowRoot.querySelector('[data-fovea-root]');
    const numbers = () =>
      [...root.querySelectorAll('[data-line]')].map((n) => Number(n.dataset.line));
    const first = numbers();
    const hit = root.querySelector('mark');
    root.scrollTop += 4000;
    root.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 100));
    const second = numbers();
    return {
      lineCount: detail.lineCount,
      drawn: first.length,
      containsTarget: first.includes(25000),
      marked: hit?.textContent,
      ordered: second.every((n, i) => i === 0 || n === second[i - 1] + 1),
      moved: second[0] > first[0],
      drawnAfter: second.length,
    };
  });
  check(
    'element: a 50 000 line file reports its line count',
    big.lineCount === 50000,
    JSON.stringify(big),
  );
  check(
    'element: only the lines near the view are in the page',
    big.drawn < 120 && big.drawnAfter < 120,
  );
  check(
    'element: the target line is drawn, its words marked',
    big.containsTarget && big.marked === '25000',
    big.marked,
  );
  check(
    'element: scrolling draws a contiguous, ordered window',
    big.ordered && big.moved,
    JSON.stringify(big),
  );

  // Plain JavaScript in the light DOM ------------------------------------------------------------
  await page.waitForFunction(() => document.querySelector('#text-host [data-line="1"]'));
  const light = await run(() => {
    const root = document.querySelector('#text-host [data-fovea-root]');
    return {
      scrolls: getComputedStyle(root).overflowY,
      inLightDom: root.getRootNode() === document,
      hasImage: Boolean(document.querySelector('#image-host img')),
    };
  });
  check(
    'vanilla: createTextViewer draws into a normal element, styled by style.css',
    light.scrolls === 'auto' && light.inLightDom,
    JSON.stringify(light),
  );
  check('vanilla: createImageViewer draws its image', light.hasImage);

  // Theme tokens on the page reach the shadow root ------------------------------------------------
  await run(() => document.getElementById('theme').click());
  await page.waitForTimeout(100);
  const dark = await run(() => ({
    element: getComputedStyle(
      document.querySelector('#text').shadowRoot.querySelector('[data-fovea-root]'),
    ).backgroundColor,
    controller: getComputedStyle(document.querySelector('#text-host [data-fovea-root]'))
      .backgroundColor,
  }));
  check(
    "theme: the page's --fovea-* tokens and the theme attribute darken the element",
    dark.element === 'rgb(30, 30, 30)',
    dark.element,
  );
  check(
    'theme: update({ theme: "dark" }) darkens the controller',
    dark.controller === 'rgb(30, 30, 30)',
    dark.controller,
  );

  // Cleanup -------------------------------------------------------------------------------------
  const left = await run(() => {
    const el = document.querySelector('#text');
    const shadow = el.shadowRoot;
    el.remove();
    return shadow.querySelectorAll('[data-fovea-root]').length;
  });
  check('element: removing it destroys the viewer', left === 0);
  check('page: no errors in the console', problems.length === 0, problems.join(' | '));
} finally {
  await browser.close();
  server.close();
}

// The React components, which now run the same controllers --------------------------------------
{
  const reactApp = join(root, 'docs/design/spikes/phase2/react-app');
  const reactOut = join(root, '.temp/spikes/react-app-dist');
  const { default: react } = await import('@vitejs/plugin-react');
  await build({
    root: reactApp,
    configFile: false,
    logLevel: 'silent',
    plugins: [react()],
    publicDir: join(root, 'examples/demo/public/samples'),
    build: { outDir: reactOut, emptyOutDir: true },
  });
  const server2 = createServer((req, res) => {
    const path = join(reactOut, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = path.endsWith('/') ? join(path, 'index.html') : path;
    if (!file.startsWith(reactOut) || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server2.listen(0, '127.0.0.1', ok));
  const browser2 = await chromium.launch();
  try {
    const page = await browser2.newPage({ viewport: { width: 1000, height: 1100 } });
    const problems = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
    await page.goto(`http://127.0.0.1:${server2.address().port}/`);
    await page.waitForFunction(
      () =>
        window.events.some((e) => e[0] === 'text') && window.events.some((e) => e[0] === 'image'),
    );
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const text = document.querySelector('#text [data-fovea-root]');
      const lines = document.querySelector('#lines [data-fovea-root]');
      const image = document.querySelector('#image [data-fovea-root]');
      const rows = (el) => el.querySelectorAll('[data-line]').length;
      const out = {
        events: window.events,
        textRows: rows(text),
        textHeight: Math.round(text.getBoundingClientRect().height),
        marked: text.querySelector('mark')?.textContent,
        scrollTop: Math.round(text.scrollTop),
        lineRows: rows(lines),
        imageToolbar: getComputedStyle(image.querySelector('[role="toolbar"]')).display,
        imageLoaded: image.querySelector('img')?.naturalWidth > 0,
      };
      document.getElementById('theme').click();
      await new Promise((resolve) => setTimeout(resolve, 150));
      out.dark = [text, image].map((el) => getComputedStyle(el).backgroundColor);
      out.textRowsAfter = rows(text);
      return out;
    });
    const detail = JSON.stringify(r);
    check(
      'react: TextViewer shows a 50 000 line file with only the lines near the view',
      r.textRows > 0 && r.textRows < 120 && r.textHeight <= 300,
      detail,
    );
    check(
      'react: TextViewer scrolls to its target and marks the words',
      r.marked === '25000' && r.scrollTop > 100000,
      `${r.marked} at ${r.scrollTop}`,
    );
    check(
      'react: LineViewer draws a window of its lines through a tokens function',
      r.lineRows > 0 && r.lineRows < 120,
      detail,
    );
    check(
      'react: ImageViewer loads and is laid out',
      r.imageLoaded && r.imageToolbar === 'flex',
      detail,
    );
    check(
      'react: both report onReady under StrictMode',
      r.events.some((e) => e[0] === 'text') && r.events.some((e) => e[0] === 'image'),
      detail,
    );
    check(
      'react: a theme prop change darkens both without redrawing everything',
      r.dark.every((c) => c === 'rgb(30, 30, 30)') && r.textRowsAfter < 120,
      detail,
    );
    check('react: no errors in the console', problems.length === 0, problems.join(' | '));
  } finally {
    await browser2.close();
    server2.close();
  }
}

for (const r of results)
  console.log(
    `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `\n      ${r.detail}` : ''}`,
  );
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
