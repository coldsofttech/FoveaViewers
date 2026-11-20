/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
import { scoreMatch, squash } from '@coldsofttech/fovea-viewers/core/vanilla';
import {
  GAP,
  ZOOM_STEP,
  boxOf,
  clampZoom,
  fitZoom,
  pageAt,
  pagesIn,
  stack,
  turn,
} from '../layout.js';
import { pageTexts } from '../pageTexts.js';
import { createPageView } from './pageView.js';
import styles from '../PdfViewer.module.css';

/**
 * @typedef {import('../pdfjs.js').Pdfjs} Pdfjs
 * @typedef {import('pdfjs-dist').PDFDocumentProxy} PDFDocumentProxy
 * @typedef {import('../layout.js').FitMode} FitMode
 * @typedef {import('../layout.js').Size} Size
 * @typedef {{ title: string, dest: unknown, items: OutlineItem[] }} OutlineItem
 */

/**
 * @typedef {object} PagesProps
 * @property {string} label
 * @property {FitMode} fit
 * @property {number} initialPage
 * @property {{ matched: string, before?: string, after?: string }} [target]
 * @property {(page: number | null) => void} [onLocated]
 * @property {(page: number) => void} [onPageChange]
 * @property {(error: Error) => void} [onError]
 */

/**
 * Turns the outline pdf.js gives into the shape the viewer shows.
 *
 * @param {any[] | null} items
 * @returns {OutlineItem[]}
 */
const outlineOf = (items) =>
  (items ?? []).map((item) => ({
    title: String(item.title ?? ''),
    dest: item.dest,
    items: outlineOf(item.items),
  }));

/**
 * The pages of an open PDF with the controls to read them: page number, zoom, fit, turn and the
 * outline. Only the pages near the view are drawn, so a long PDF opens at once. The toolbar and the
 * pages are added to `parent`.
 *
 * @param {object} options
 * @param {HTMLElement} options.parent
 * @param {ReturnType<typeof import('@coldsofttech/fovea-viewers/core/vanilla').createH>} options.h
 * @param {Pdfjs} options.pdfjs
 * @param {PDFDocumentProxy} options.doc
 * @param {PagesProps} options.props
 * @returns {{ update: (next: PagesProps) => void, destroy: () => void }}
 */
export function createPages({ parent, h, pdfjs, doc, props }) {
  const count = doc.numPages;
  let current = props;
  let view = { mode: /** @type {FitMode | 'custom'} */ (props.fit), zoom: 1, rotation: 0 };
  let box = { width: 0, height: 0 };
  let top = 0;
  /** @type {Map<number, Size>} */
  let sizes = new Map();
  /** @type {OutlineItem[]} */
  let outline = [];
  let sidebar = false;
  /** @type {string | null} */
  let draft = null;
  let stopped = false;
  /** @type {{ key: string, page: number | null } | null} */
  let found = null;
  /** @type {number | null} */
  let lastScale = null;
  let started = false;
  let scrolledFor = '';
  /** @type {number | null} */
  let reportedPage = null;
  let reportedLocated = '';
  /** @type {Map<number, { slot: HTMLElement, page: ReturnType<typeof createPageView> }>} */
  const slots = new Map();

  const failed = (/** @type {Error} */ error) => current.onError?.(error);

  // --- the controls ---------------------------------------------------------------------------
  /** @param {string} name @param {string} text @param {() => void} act */
  const button = (name, text, act) =>
    /** @type {HTMLButtonElement} */ (
      h('button', { type: 'button', 'aria-label': name, onclick: act }, text)
    );
  const outlineButton = button('Outline', '☰', () => {
    sidebar = !sidebar;
    render();
  });
  const pageInput = /** @type {HTMLInputElement} */ (
    h('input', {
      type: 'number',
      'aria-label': 'Page number',
      class: styles.pageInput,
      min: 1,
      max: count,
      oninput: (/** @type {Event} */ event) => {
        draft = /** @type {HTMLInputElement} */ (event.target).value;
      },
      onkeydown: (/** @type {KeyboardEvent} */ event) => {
        if (event.key !== 'Enter') return;
        const page = Number.parseInt(draft ?? '', 10);
        if (Number.isFinite(page)) scrollToPage(page);
        draft = null;
        render();
      },
      onblur: () => {
        draft = null;
        render();
      },
    })
  );
  const zoomOut = button('Zoom out', '−', () => zoomBy(1 / ZOOM_STEP));
  const zoomText = h('span', { class: styles.zoom });
  const zoomIn = button('Zoom in', '+', () => zoomBy(ZOOM_STEP));
  const controls = [
    zoomOut,
    zoomIn,
    button('Fit to width', 'Width', () => fitTo('width')),
    button('Fit to page', 'Page', () => fitTo('page')),
    button('Rotate left', '↺', () => rotate(-1)),
    button('Rotate right', '↻', () => rotate(1)),
  ];
  const toolbar = h(
    'div',
    { class: styles.toolbar, role: 'toolbar', 'aria-label': 'PDF controls' },
    h('div', { class: styles.pageForm }, pageInput, h('span', null, `of ${count}`)),
    zoomOut,
    zoomText,
    ...controls.slice(1),
  );

  // --- the pages ------------------------------------------------------------------------------
  // The pages take focus so the keyboard can scroll and zoom them.
  const scroller = h('div', { role: 'region', tabindex: '0', class: styles.scroller });
  const pagesBox = h('div', { class: styles.pages });
  scroller.append(pagesBox);
  const workspace = h('div', { class: styles.workspace }, scroller);
  parent.append(toolbar, workspace);
  /** @type {HTMLElement | null} */
  let nav = null;

  /** A page's own size is learned when it is drawn. Until then every page is taken to be as big as the first. */
  function onSize(/** @type {number} */ number, /** @type {Size} */ size) {
    const known = sizes.get(number);
    if (known && known.width === size.width && known.height === size.height) return;
    sizes = new Map(sizes).set(number, size);
    render();
  }

  function scrollToPage(/** @type {number} */ page) {
    const { tops } = geometry();
    const at = tops.at(Math.min(count, Math.max(1, page)) - 1);
    if (at !== undefined) scroller.scrollTop = at - GAP;
  }

  /** Where each page is, and how big. */
  function geometry() {
    const base = sizes.get(1) ?? null;
    const scale =
      view.mode === 'custom' || !base
        ? view.zoom
        : fitZoom(view.mode, boxOf(base, 1, view.rotation), box);
    const boxes = base
      ? Array.from({ length: count }, (_, i) =>
          boxOf(sizes.get(i + 1) ?? base, scale, view.rotation),
        )
      : [];
    const heights = boxes.map((one) => one.height);
    const widths = boxes.map((one) => one.width);
    const widest = Math.max(0, ...widths);
    return {
      ...stack(heights),
      heights,
      widths,
      scale,
      base,
      width: Math.max(box.width, widest + GAP * 2),
    };
  }

  /** @param {number} factor */
  function zoomBy(factor) {
    view = { ...view, mode: 'custom', zoom: clampZoom(geometry().scale * factor) };
    render();
  }
  /** @param {FitMode} mode */
  function fitTo(mode) {
    view = { ...view, mode };
    render();
  }
  /** @param {1 | -1} direction */
  function rotate(direction) {
    view = { ...view, rotation: turn(view.rotation, direction) };
    render();
  }

  /** @param {unknown} dest */
  async function go(dest) {
    try {
      const resolved = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(resolved)) return;
      const ref = resolved[0];
      const index = typeof ref === 'number' ? ref : await doc.getPageIndex(ref);
      scrollToPage(index + 1);
    } catch {
      // A broken link in the outline leads nowhere; the reader stays where they are.
    }
  }

  /**
   * @param {OutlineItem[]} items
   * @returns {HTMLElement}
   */
  function outlineList(items) {
    return h(
      'ul',
      { class: styles.outline },
      items.map((item) =>
        h(
          'li',
          null,
          item.dest
            ? h(
                'button',
                { type: 'button', class: styles.outlineButton, onclick: () => go(item.dest) },
                item.title,
              )
            : h('span', { class: styles.outlineText }, item.title),
          item.items.length > 0 ? outlineList(item.items) : null,
        ),
      ),
    );
  }

  function render() {
    if (stopped) return;
    const g = geometry();
    const { tops, heights, widths, total, scale, width } = g;
    const ready = tops.length > 0;

    // Keep the place in the document when the zoom changes (a button, a fit, or the view resizing).
    if (lastScale !== null && lastScale !== scale) {
      scroller.scrollTop = (scroller.scrollTop * scale) / lastScale;
      top = scroller.scrollTop;
    }
    lastScale = scale;

    const buffer = Math.max(box.height, 600);
    const visible = pagesIn(tops, heights, top - buffer, top + box.height + buffer);
    const atEnd = tops.length > 0 && top + box.height >= total - 1 && top > 0;
    const page = tops.length === 0 ? 1 : atEnd ? count : pageAt(tops, top + box.height / 3) + 1;

    // The toolbar.
    outlineButton.setAttribute('aria-expanded', String(sidebar));
    if (outline.length > 0 && !outlineButton.isConnected) toolbar.prepend(outlineButton);
    if (outline.length === 0) outlineButton.remove();
    pageInput.disabled = !ready;
    pageInput.value = draft ?? String(page);
    for (const control of controls) /** @type {HTMLButtonElement} */ (control).disabled = !ready;
    zoomText.textContent = ready ? `${Math.round(scale * 100)}%` : '';

    // The outline.
    if (sidebar && outline.length > 0) {
      if (!nav) {
        nav = h('nav', { class: styles.sidebar, 'aria-label': 'Outline' }, outlineList(outline));
        workspace.prepend(nav);
      }
    } else if (nav) {
      nav.remove();
      nav = null;
    }

    // The pages: only the ones near the view are drawn.
    scroller.setAttribute('aria-label', current.label);
    pagesBox.style.width = `${width}px`;
    pagesBox.style.height = `${total}px`;
    for (const [index, entry] of slots) {
      if (!visible.includes(index)) {
        entry.page.destroy();
        entry.slot.remove();
        slots.delete(index);
      }
    }
    const located =
      squash(current.target?.matched) && found?.key === targetKey() ? found.page : null;
    for (const index of visible) {
      let entry = slots.get(index);
      if (!entry) {
        const slot = h('div', { class: styles.slot });
        pagesBox.append(slot);
        entry = {
          slot,
          page: createPageView({
            parent: slot,
            h,
            pdfjs,
            doc,
            number: index + 1,
            props: pageProps(index, g, located),
            onSize,
            onError: failed,
          }),
        };
        slots.set(index, entry);
      } else {
        entry.page.update(pageProps(index, g, located));
      }
      entry.slot.style.top = `${tops[index]}px`;
      entry.slot.style.left = `${(width - widths[index]) / 2}px`;
    }

    if (tops.length > 0 && page !== reportedPage) current.onPageChange?.(page);
    reportedPage = tops.length > 0 ? page : null;

    if (!started && tops.length > 0) {
      started = true;
      // Only the first layout goes to the first page; after that the reader is in charge.
      if (current.initialPage > 1) scrollToPage(current.initialPage);
    }
    if (located !== null && tops.length > 0 && scrolledFor !== targetKey()) {
      scrolledFor = targetKey();
      scrollToPage(located);
    }
    reportLocation();
  }

  const targetKey = () => {
    const { target } = current;
    return `${target?.matched}\u0000${target?.before}\u0000${target?.after}`;
  };

  /** @param {number} index @param {ReturnType<typeof geometry>} g @param {number | null} located */
  function pageProps(index, g, located) {
    const { target } = current;
    return {
      scale: g.scale,
      rotation: view.rotation,
      width: g.widths[index],
      height: g.heights[index],
      mark:
        index + 1 === located && target?.matched
          ? { matched: target.matched, before: target.before, after: target.after }
          : null,
    };
  }

  /** Tells the host which page the target is on, once for each answer. */
  function reportLocation() {
    const { target } = current;
    let answer = '';
    if (!squash(target?.matched)) answer = 'none';
    else if (found?.key === targetKey()) answer = `${targetKey()}:${found.page}`;
    if (!answer || answer === reportedLocated) return;
    reportedLocated = answer;
    current.onLocated?.(
      answer === 'none' ? null : /** @type {{ page: number | null }} */ (found).page,
    );
  }

  /** The page that holds the target: the one where the words and their surroundings agree best. */
  function findTarget() {
    const { target } = current;
    const needle = squash(target?.matched);
    const key = targetKey();
    if (!needle) return;
    pageTexts(doc).then(
      (texts) => {
        let best = null;
        let bestScore = -1;
        texts.forEach((hay, index) => {
          const { at, score } = scoreMatch(
            hay,
            needle,
            squash(target?.before),
            squash(target?.after),
          );
          if (at !== -1 && score > bestScore) {
            best = index + 1;
            bestScore = score;
          }
        });
        if (!stopped && key === targetKey()) {
          found = { key, page: best };
          render();
        }
      },
      () => {
        if (!stopped && key === targetKey()) {
          found = { key, page: null };
          render();
        }
      },
    );
  }

  // --- wiring ---------------------------------------------------------------------------------
  scroller.addEventListener('scroll', () => {
    top = scroller.scrollTop;
    render();
  });
  // Holding Ctrl (or pinching) zooms. The listener must not be passive, so it can stop the page
  // zooming instead.
  scroller.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * 0.01));
    },
    { passive: false },
  );
  scroller.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = new Map([
      ['+', () => zoomBy(ZOOM_STEP)],
      ['=', () => zoomBy(ZOOM_STEP)],
      ['-', () => zoomBy(1 / ZOOM_STEP)],
      ['_', () => zoomBy(1 / ZOOM_STEP)],
      ['0', () => fitTo('width')],
      ['[', () => rotate(-1)],
      [']', () => rotate(1)],
    ]);
    const action = keys.get(event.key);
    if (!action) return;
    event.preventDefault();
    action();
  });
  /** @type {ResizeObserver | undefined} */
  let observer;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([entry]) => {
      box = { width: entry.contentRect.width, height: entry.contentRect.height };
      render();
    });
    observer.observe(scroller);
  }

  doc.getPage(1).then(
    (first) => {
      const { width, height } = first.getViewport({ scale: 1 });
      if (!stopped) onSize(1, { width, height });
    },
    (cause) => {
      if (!stopped) failed(cause instanceof Error ? cause : new Error(String(cause)));
    },
  );
  doc.getOutline().then(
    (items) => {
      if (!stopped) {
        outline = outlineOf(items);
        render();
      }
    },
    () => {},
  );
  findTarget();
  render();

  return {
    update(next) {
      const previousKey = targetKey();
      current = next;
      if (targetKey() !== previousKey) {
        found = null;
        findTarget();
      }
      render();
    },
    destroy() {
      stopped = true;
      observer?.disconnect();
      for (const entry of slots.values()) entry.page.destroy();
      slots.clear();
      toolbar.remove();
      workspace.remove();
    },
  };
}
