import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { HtmlViewer } from './HtmlViewer.jsx';
import { defineHtmlElement } from './element.js';
import { createHtmlViewer } from './vanilla/index.js';

/** jsdom does not load a frame's `srcdoc`, so the test puts the page in and says it has loaded. */
function settleFrame(frame) {
  const srcdoc = frame.getAttribute('srcdoc');
  if (!srcdoc || frame.dataset.settled === srcdoc) return;
  frame.dataset.settled = srcdoc;
  const doc = frame.contentDocument;
  doc.open();
  doc.write(srcdoc);
  doc.close();
  frame.dispatchEvent(new Event('load'));
}
const settle = (root) => {
  const frame = root.querySelector('iframe');
  if (frame) settleFrame(frame);
};

describeConformance('html', {
  settle,
  // The frame reports a load for its empty first document as well as for the page.
  readyOnce: false,
  textOf: (root) => root.querySelector('iframe')?.getAttribute('srcdoc') ?? '',
  // The page inside the frame is the file's own; the viewer's part is the frame and its title.
  axeOptions: { iframes: false },
  text: '<body><p>hello page</p></body>',
  // A page is drawn on white whatever the theme around it, so the viewer has no theme.
  hasTheme: false,
  shows: (root) =>
    expect(root.querySelector('iframe').getAttribute('srcdoc')).toContain('hello page'),
  adapters: [
    vanillaAdapter(createHtmlViewer),
    elementAdapter('fovea-html', defineHtmlElement),
    reactComponentAdapter(HtmlViewer),
  ],
});

describe('<fovea-html>', () => {
  afterEach(() => vi.restoreAllMocks());

  /** An element with a page that has a link in it, and the frame's document. */
  async function open(setup = () => {}) {
    const el = document.createElement('fovea-html');
    setup(el);
    el.source = new Blob([
      '<body><p>words <a id="a" href="https://example.test/next">next</a></p></body>',
    ]);
    document.body.append(el);
    const frame = await vi.waitFor(() => {
      const f = el.shadowRoot.querySelector('iframe');
      if (f) settleFrame(f);
      if (!f?.contentDocument?.getElementById('a')) throw new Error('page not loaded');
      return f;
    });
    const doc = frame.contentDocument;
    const click = () => {
      const event = new doc.defaultView.MouseEvent('click', { cancelable: true, bubbles: true });
      doc.getElementById('a').dispatchEvent(event);
      return event;
    };
    return { el, doc, click };
  }

  it('fires a cancelable fovea-navigate for a click on a link, and does nothing by default', async () => {
    const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
    const { el, click } = await open();
    const seen = vi.fn();
    el.addEventListener('fovea-navigate', (e) => seen(e.detail.href));
    const event = click();
    expect(seen).toHaveBeenCalledWith('https://example.test/next');
    expect(event.defaultPrevented).toBe(true);
    expect(open_).not.toHaveBeenCalled();
    el.remove();
  });

  it('opens http links in a new window when links="window" and nobody cancelled the event', async () => {
    const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
    const { el, click } = await open((e) => e.setAttribute('links', 'window'));
    click();
    expect(open_).toHaveBeenCalledWith(
      'https://example.test/next',
      '_blank',
      'noopener,noreferrer',
    );
    el.addEventListener('fovea-navigate', (e) => e.preventDefault());
    open_.mockClear();
    click();
    expect(open_).not.toHaveBeenCalled();
    el.remove();
  });

  it('marks the target and reports it in fovea-marked', async () => {
    const marked = vi.fn();
    const { el, doc } = await open((e) => {
      e.addEventListener('fovea-marked', (event) => marked(event.detail));
      e.target = { matched: 'words' };
    });
    await vi.waitFor(() => expect(doc.querySelector('mark')).toHaveTextContent('words'));
    expect(marked).toHaveBeenLastCalledWith(true);
    el.target = undefined;
    await vi.waitFor(() => expect(marked).toHaveBeenLastCalledWith(null));
    expect(doc.querySelector('mark')).toBeNull();
    el.remove();
  });
});

describe('createHtmlViewer', () => {
  it('starts a new frame when scripts are turned on, and fills its container', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onReady = vi.fn();
    const viewer = createHtmlViewer(host, { source: new Blob(['<p>x</p>']), onReady });
    await vi.waitFor(() => {
      settle(viewer.element);
      expect(onReady).toHaveBeenLastCalledWith({ allowScripts: false });
    });
    const first = viewer.element.querySelector('iframe');
    expect(first.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(first.style.height).toBe('100%');
    viewer.update({ allowScripts: true });
    const second = viewer.element.querySelector('iframe');
    expect(second).not.toBe(first);
    expect(second.getAttribute('sandbox')).toBe('allow-scripts');
    // A frame that runs scripts has no same-origin document to put a page in, so it only loads.
    second.dispatchEvent(new Event('load'));
    expect(onReady).toHaveBeenLastCalledWith({ allowScripts: true });
    viewer.destroy();
    host.remove();
  });
});
