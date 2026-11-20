/* Phase 0 spikes: the existing viewers and helpers, run inside shadow roots in a real browser. */
import { createRoot } from 'react-dom/client';
import { markIn, clearMarks } from '../../../../../packages/fovea-viewers/src/core/mark.js';
import { MarkdownViewer } from '@coldsofttech/fovea-markdown';
import { HtmlViewer } from '@coldsofttech/fovea-html';
import { PdfViewer } from '@coldsofttech/fovea-pdf';
import markdownCss from '@spike/markdown-css';
import htmlCss from '@coldsofttech/fovea-html/style.css?raw';
import pdfCss from '@coldsofttech/fovea-pdf/style.css?raw';

const stage = document.getElementById('stage');

/** Waits until `check()` returns something truthy. */
async function waitFor(check, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** A host element with an open shadow root, optionally with a stylesheet adopted into it. */
function shadowHost(css, { height = '300px' } = {}) {
  const host = document.createElement('div');
  host.style.cssText = `display:block;height:${height};`;
  stage.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  if (css) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  }
  const mount = document.createElement('div');
  mount.style.height = '100%';
  shadow.append(mount);
  return { host, shadow, mount };
}

const results = [];
async function spike(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? '' });
  } catch (error) {
    results.push({ name, ok: false, detail: String(error?.message ?? error) });
  }
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

window.runSpikes = async () => {
  // 1. The core helpers on plain DOM inside a shadow root ---------------------------------------
  await spike('shadow: markIn on an element inside a shadow root', () => {
    const { shadow, mount } = shadowHost();
    mount.innerHTML = '<p>Hello <b>wor</b>ld and more</p>';
    const mark = markIn(mount, { matched: 'world' });
    assert(mark, 'no mark returned');
    const marks = shadow.querySelectorAll('mark[data-fovea-hit]');
    assert(marks.length === 2, `expected 2 marks (split across <b>), got ${marks.length}`);
    assert(!document.querySelector('mark'), 'a mark leaked into the light DOM');
    clearMarks(mount);
    assert(shadow.querySelectorAll('mark').length === 0, 'clearMarks left marks');
    return 'marks split across elements; clearMarks restores';
  });

  await spike('shadow: markIn / clearMarks with the ShadowRoot itself as root', () => {
    const { shadow, mount } = shadowHost();
    mount.innerHTML = '<p>alpha beta gamma</p>';
    const mark = markIn(/** @type {any} */ (shadow), { matched: 'beta' });
    assert(mark, 'no mark when root is the ShadowRoot');
    clearMarks(/** @type {any} */ (shadow));
    assert(shadow.querySelectorAll('mark').length === 0, 'clearMarks(ShadowRoot) left marks');
    return 'works (ownerDocument, TreeWalker and querySelectorAll accept a ShadowRoot)';
  });

  // 2. Theme tokens, isolation and constructable stylesheets -------------------------------------
  await spike('shadow: --fovea-* theme tokens inherit from the host into the shadow', () => {
    const { host, shadow, mount } = shadowHost('.r{background:var(--fovea-background,white)}');
    host.style.setProperty('--fovea-background', 'rgb(1, 2, 3)');
    mount.className = 'r';
    const got = getComputedStyle(mount).backgroundColor;
    assert(got === 'rgb(1, 2, 3)', `got ${got}`);
    assert(shadow.adoptedStyleSheets.length === 1, 'sheet not adopted');
    return 'custom properties cross the boundary';
  });

  await spike('shadow: page-level CSS does not leak into the shadow root', () => {
    const { mount } = shadowHost();
    mount.innerHTML = '<p>inside</p>';
    const inside = getComputedStyle(mount.querySelector('p')).color;
    assert(inside !== 'rgb(255, 0, 0)', `page rule leaked in: ${inside}`);
    return 'isolated';
  });

  // 3. The real markdown viewer in a shadow root, CSS delivered as a JS string -------------------
  const markdown =
    `# Title\n\n${'Filler paragraph. '.repeat(40)}\n\n`.repeat(60) +
    '\nThe needle sits at the very end of this long file.\n';
  await spike('markdown: styled by an adopted sheet built from the CSS-as-JS module', async () => {
    const { shadow, mount } = shadowHost(markdownCss);
    let found = 'unset';
    let ready = false;
    createRoot(mount).render(
      <MarkdownViewer
        source={new Blob([markdown])}
        target={{ line: markdown.split('\n').length - 1, matched: 'needle' }}
        onMarked={(f) => (found = f)}
        onReady={() => (ready = true)}
      />,
    );
    await waitFor(() => ready && found !== 'unset');
    assert(found === true, `onMarked(${found})`);
    const root = shadow.querySelector('[class*="root"]');
    assert(getComputedStyle(root).overflowY === 'auto', 'CSS module rules not applied');
    const hit = shadow.querySelector('mark[data-fovea-hit]');
    assert(hit && hit.textContent.toLowerCase().includes('needle'), 'target not marked');
    await waitFor(() => root.scrollTop > 100);
    return `marked and scrolled (scrollTop ${Math.round(root.scrollTop)})`;
  });

  await spike('markdown: WITHOUT the adopted sheet the CSS is absent (control)', async () => {
    const { shadow, mount } = shadowHost(null);
    let ready = false;
    createRoot(mount).render(
      <MarkdownViewer source={new Blob(['# hi'])} onReady={() => (ready = true)} />,
    );
    await waitFor(() => ready);
    const root = shadow.querySelector('[class*="root"]');
    assert(getComputedStyle(root).overflowY !== 'auto', 'rules applied without a sheet?');
    return 'a document-level import of style.css would NOT reach the shadow root';
  });

  // 4. The sandboxed iframe viewer in a shadow root ---------------------------------------------
  await spike('html: sandboxed iframe works inside a shadow root, target marked', async () => {
    const { shadow, mount } = shadowHost(htmlCss);
    let found = 'unset';
    createRoot(mount).render(
      <HtmlViewer
        source={new Blob(['<p>One two three <b>four</b> five</p>'])}
        target={{ matched: 'three four' }}
        onMarked={(f) => (found = f)}
      />,
    );
    await waitFor(() => found !== 'unset');
    assert(found === true, `onMarked(${found})`);
    const frame = shadow.querySelector('iframe');
    assert(frame, 'no iframe in the shadow root');
    const inFrame = frame.contentDocument?.querySelectorAll('mark[data-fovea-hit]').length;
    assert(inFrame > 0, 'no marks inside the frame');
    return `iframe present; ${inFrame} mark(s) inside the frame`;
  });

  // 5. PDF: pdf.js and its worker from a consumer app's bundle, in a shadow root ----------------
  await spike('pdf: worker resolves and a page renders inside a shadow root', async () => {
    const { shadow, mount } = shadowHost(pdfCss, { height: '500px' });
    let pageCount = 0;
    let failure = null;
    createRoot(mount).render(
      <PdfViewer
        source="/sample.pdf"
        onReady={(i) => (pageCount = i.pageCount)}
        onError={(e) => (failure = e)}
      />,
    );
    await waitFor(() => pageCount || failure);
    assert(!failure, `error: ${failure?.message}`);
    // 300x150 is a canvas nobody has drawn on: wait for a resized canvas with painted pixels.
    const canvas = await waitFor(() => {
      const c = shadow.querySelector('canvas');
      if (!c || (c.width === 300 && c.height === 150)) return null;
      const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      return data.some((v) => v !== 0) ? c : null;
    });
    return `${pageCount} page(s); canvas ${canvas.width}x${canvas.height} has painted pixels`;
  });

  return results;
};
