/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { scoreMatch, squash, useLatest } from '@coldsofttech/fovea-viewers/core';
import { Outline } from './Outline.jsx';
import { PageView } from './PageView.jsx';
import { pageTexts } from './pageTexts.js';
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
} from './layout.js';
import styles from './PdfViewer.module.css';

/**
 * @typedef {import('./pdfjs.js').Pdfjs} Pdfjs
 * @typedef {import('pdfjs-dist').PDFDocumentProxy} PDFDocumentProxy
 * @typedef {import('./layout.js').FitMode} FitMode
 * @typedef {import('./layout.js').Size} Size
 * @typedef {import('./Outline.jsx').OutlineItem} OutlineItem
 */

/**
 * @typedef {object} PagesProps
 * @property {Pdfjs} pdfjs
 * @property {PDFDocumentProxy} doc
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
 * outline. Only the pages near the view are drawn, so a long PDF opens at once.
 *
 * @param {PagesProps} props
 */
export function Pages({
  pdfjs,
  doc,
  label,
  fit,
  initialPage,
  target,
  onLocated,
  onPageChange,
  onError,
}) {
  const count = doc.numPages;
  const scroller = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [view, setView] = useState({
    mode: /** @type {FitMode | 'custom'} */ (fit),
    zoom: 1,
    rotation: 0,
  });
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [top, setTop] = useState(0);
  const [sizes, setSizes] = useState(/** @type {Map<number, Size>} */ (new Map()));
  const [outline, setOutline] = useState(/** @type {OutlineItem[]} */ ([]));
  const [sidebar, setSidebar] = useState(false);
  const [draft, setDraft] = useState(/** @type {string | null} */ (null));

  const report = useRef(onError);
  useEffect(() => {
    report.current = onError;
  });
  const failed = useMemo(() => (/** @type {Error} */ error) => report.current?.(error), []);

  // A page's own size is learned when it is drawn. Until then every page is taken to be as big
  // as the first.
  const onSize = useMemo(
    () => (/** @type {number} */ number, /** @type {Size} */ size) =>
      setSizes((previous) => {
        const known = previous.get(number);
        if (known && known.width === size.width && known.height === size.height) return previous;
        return new Map(previous).set(number, size);
      }),
    [],
  );
  useEffect(() => {
    let stopped = false;
    doc.getPage(1).then(
      (page) => {
        const { width, height } = page.getViewport({ scale: 1 });
        if (!stopped) onSize(1, { width, height });
      },
      (cause) => {
        if (!stopped) failed(cause instanceof Error ? cause : new Error(String(cause)));
      },
    );
    return () => {
      stopped = true;
    };
  }, [doc, onSize, failed]);

  useEffect(() => {
    let stopped = false;
    doc.getOutline().then(
      (items) => {
        if (!stopped) setOutline(outlineOf(items));
      },
      () => {},
    );
    return () => {
      stopped = true;
    };
  }, [doc]);

  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Where each page is, and how big.
  const base = sizes.get(1) ?? null;
  const scale =
    view.mode === 'custom' || !base
      ? view.zoom
      : fitZoom(view.mode, boxOf(base, 1, view.rotation), box);
  const layout = useMemo(() => {
    const boxes = base
      ? Array.from({ length: count }, (_, i) =>
          boxOf(sizes.get(i + 1) ?? base, scale, view.rotation),
        )
      : [];
    const heights = boxes.map((one) => one.height);
    const widths = boxes.map((one) => one.width);
    return { ...stack(heights), heights, widths, widest: Math.max(0, ...widths) };
  }, [base, count, sizes, scale, view.rotation]);
  const { tops, heights, widths, total } = layout;
  const width = Math.max(box.width, layout.widest + GAP * 2);

  const buffer = Math.max(box.height, 600);
  const visible = pagesIn(tops, heights, top - buffer, top + box.height + buffer);
  const atEnd = tops.length > 0 && top + box.height >= total - 1 && top > 0;
  const current = tops.length === 0 ? 1 : atEnd ? count : pageAt(tops, top + box.height / 3) + 1;

  const changed = useLatest(onPageChange);
  useEffect(() => {
    if (tops.length > 0) changed.current?.(current);
  }, [current, tops.length, changed]);

  // Keep the place in the document when the zoom changes (a button, a fit, or the view resizing).
  const lastScale = useRef(scale);
  useLayoutEffect(() => {
    const before = lastScale.current;
    lastScale.current = scale;
    const element = scroller.current;
    if (element && before !== scale) element.scrollTop = (element.scrollTop * scale) / before;
  }, [scale]);

  /** @param {number} page */
  const scrollToPage = (page) => {
    const element = scroller.current;
    const at = tops.at(Math.min(count, Math.max(1, page)) - 1);
    if (element && at !== undefined) element.scrollTop = at - GAP;
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current || tops.length === 0) return;
    started.current = true;
    if (initialPage > 1) scrollToPage(initialPage);
    // Only the first layout goes to the first page; after that the reader is in charge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tops.length, initialPage]);

  // The page that holds the target: the one where the words and their surroundings agree best.
  const matched = target?.matched;
  const before = target?.before;
  const after = target?.after;
  const key = `${matched}\u0000${before}\u0000${after}`;
  const [found, setFound] = useState(
    /** @type {{ key: string, page: number | null } | null} */ (null),
  );
  useEffect(() => {
    const needle = squash(matched);
    if (!needle) return undefined;
    let stopped = false;
    pageTexts(doc).then(
      (texts) => {
        let best = null;
        let bestScore = -1;
        texts.forEach((hay, index) => {
          const { at, score } = scoreMatch(hay, needle, squash(before), squash(after));
          if (at !== -1 && score > bestScore) {
            best = index + 1;
            bestScore = score;
          }
        });
        if (!stopped) setFound({ key, page: best });
      },
      () => {
        if (!stopped) setFound({ key, page: null });
      },
    );
    return () => {
      stopped = true;
    };
  }, [doc, key, matched, before, after]);
  const located = squash(matched) && found?.key === key ? found.page : null;

  const reportLocated = useLatest(onLocated);
  useEffect(() => {
    if (!squash(matched)) reportLocated.current?.(null);
    else if (found?.key === key) reportLocated.current?.(found.page);
  }, [matched, key, found, reportLocated]);

  const scrolledFor = useRef('');
  useEffect(() => {
    if (located === null || tops.length === 0 || scrolledFor.current === key) return;
    scrolledFor.current = key;
    scrollToPage(located);
    // Go to the page once for each target, not again whenever the layout settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, key, tops.length]);

  /** @param {number} factor */
  const zoomBy = (factor) =>
    setView((previous) => ({ ...previous, mode: 'custom', zoom: clampZoom(scale * factor) }));
  /** @param {FitMode} mode */
  const fitTo = (mode) => setView((previous) => ({ ...previous, mode }));
  /** @param {1 | -1} direction */
  const rotate = (direction) =>
    setView((previous) => ({ ...previous, rotation: turn(previous.rotation, direction) }));

  // Holding Ctrl (or pinching) zooms. React's own wheel listener cannot stop the page zooming
  // instead, so this one is added by hand.
  const wheel = useLatest((/** @type {WheelEvent} */ event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(Math.exp(-event.deltaY * 0.01));
  });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return undefined;
    const onWheel = (/** @type {WheelEvent} */ event) => wheel.current(event);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [wheel]);

  /** @param {import('react').KeyboardEvent} event */
  const onKeyDown = (event) => {
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
  };

  /** @param {unknown} dest */
  const go = async (dest) => {
    try {
      const resolved = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(resolved)) return;
      const ref = resolved[0];
      const index = typeof ref === 'number' ? ref : await doc.getPageIndex(ref);
      scrollToPage(index + 1);
    } catch {
      // A broken link in the outline leads nowhere; the reader stays where they are.
    }
  };

  const ready = tops.length > 0;
  const percent = `${Math.round(scale * 100)}%`;

  return (
    <>
      <div className={styles.toolbar} role="toolbar" aria-label="PDF controls">
        {outline.length > 0 && (
          <button
            type="button"
            aria-label="Outline"
            aria-expanded={sidebar}
            onClick={() => setSidebar((open) => !open)}
          >
            ☰
          </button>
        )}
        <div className={styles.pageForm}>
          <input
            type="number"
            aria-label="Page number"
            className={styles.pageInput}
            min={1}
            max={count}
            disabled={!ready}
            value={draft ?? String(current)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              const page = Number.parseInt(draft ?? '', 10);
              if (Number.isFinite(page)) scrollToPage(page);
              setDraft(null);
            }}
            onBlur={() => setDraft(null)}
          />
          <span>of {count}</span>
        </div>
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!ready}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          −
        </button>
        <span className={styles.zoom}>{ready ? percent : ''}</span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!ready}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Fit to width"
          disabled={!ready}
          onClick={() => fitTo('width')}
        >
          Width
        </button>
        <button
          type="button"
          aria-label="Fit to page"
          disabled={!ready}
          onClick={() => fitTo('page')}
        >
          Page
        </button>
        <button type="button" aria-label="Rotate left" disabled={!ready} onClick={() => rotate(-1)}>
          ↺
        </button>
        <button type="button" aria-label="Rotate right" disabled={!ready} onClick={() => rotate(1)}>
          ↻
        </button>
      </div>
      <div className={styles.workspace}>
        {sidebar && outline.length > 0 && (
          <nav className={styles.sidebar} aria-label="Outline">
            <Outline items={outline} onGo={go} />
          </nav>
        )}
        {/* The pages take focus so the keyboard can scroll and zoom them. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={scroller}
          role="region"
          aria-label={label}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className={styles.scroller}
          onScroll={(event) => setTop(event.currentTarget.scrollTop)}
          onKeyDown={onKeyDown}
        >
          <div className={styles.pages} style={{ width, height: total }}>
            {visible.map((index) => (
              <div
                key={index}
                className={styles.slot}
                style={{ top: tops[index], left: (width - widths[index]) / 2 }}
              >
                <PageView
                  pdfjs={pdfjs}
                  doc={doc}
                  number={index + 1}
                  scale={scale}
                  rotation={view.rotation}
                  width={widths[index]}
                  height={heights[index]}
                  mark={index + 1 === located && matched ? { matched, before, after } : null}
                  onSize={onSize}
                  onError={failed}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
