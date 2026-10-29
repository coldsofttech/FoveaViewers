import { useEffect, useRef, useState } from 'react';
import { clearMarks, markIn } from '@coldsofttech/fovea-viewers/core';
import styles from './PdfViewer.module.css';

/**
 * @typedef {import('./pdfjs.js').Pdfjs} Pdfjs
 * @typedef {import('pdfjs-dist').PDFDocumentProxy} PDFDocumentProxy
 */

/** The most pixels a page's picture may have, so a high zoom cannot use up the browser's memory. */
const MAX_PIXELS = 16_000_000;

/**
 * @typedef {object} PageViewProps
 * @property {Pdfjs} pdfjs
 * @property {PDFDocumentProxy} doc
 * @property {number} number The page's number, from 1.
 * @property {number} scale
 * @property {number} rotation The reader's turn, in degrees.
 * @property {number} width The page's width on screen.
 * @property {number} height The page's height on screen.
 * @property {{ matched: string, before?: string, after?: string } | null} mark Words to mark on
 *   this page.
 * @property {(number: number, size: { width: number, height: number }) => void} onSize Called
 *   with the page's own size, once it is known.
 * @property {(error: Error) => void} onError
 */

/**
 * One page: its picture, and over it the text a reader can select and find words in. It draws
 * itself when it appears and again when the zoom or turn changes, and stops when it goes.
 *
 * @param {PageViewProps} props
 */
export function PageView({
  pdfjs,
  doc,
  number,
  scale,
  rotation,
  width,
  height,
  mark,
  onSize,
  onError,
}) {
  const canvas = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const layer = useRef(/** @type {HTMLDivElement | null} */ (null));
  // Counts the times the text has been drawn, so the words are marked again after each.
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    let stopped = false;
    /** @type {import('pdfjs-dist').RenderTask | null} */
    let painting = null;
    /** @type {import('pdfjs-dist').TextLayer | null} */
    let text = null;
    (async () => {
      try {
        const page = await doc.getPage(number);
        if (stopped) return;
        const own = page.getViewport({ scale: 1 });
        onSize(number, { width: own.width, height: own.height });
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });

        const element = canvas.current;
        const container = layer.current;
        if (!element || !container) return;
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          Math.sqrt(MAX_PIXELS / (viewport.width * viewport.height)),
        );
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        painting = page.render({
          canvas: element,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });

        container.replaceChildren();
        text = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport,
        });
        await Promise.all([painting.promise, text.render()]);
        if (!stopped) setDrawn((count) => count + 1);
      } catch (cause) {
        // Stopping a page part-way is not a failure.
        if (stopped) return;
        onError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    })();
    return () => {
      stopped = true;
      painting?.cancel();
      text?.cancel();
    };
  }, [pdfjs, doc, number, scale, rotation, onSize, onError]);

  // Mark the words on this page once its text is there.
  const matched = mark?.matched;
  const before = mark?.before;
  const after = mark?.after;
  useEffect(() => {
    const container = layer.current;
    if (!container || drawn === 0) return;
    clearMarks(container);
    if (matched === undefined) return;
    const first = markIn(container, { matched, before, after });
    first?.scrollIntoView?.({ block: 'center' });
  }, [drawn, matched, before, after]);

  return (
    <div
      className={styles.page}
      role="group"
      aria-label={`Page ${number}`}
      data-page={number}
      style={{ width, height }}
    >
      <canvas ref={canvas} className={styles.canvas} style={{ width, height }} aria-hidden="true" />
      <div
        ref={layer}
        className={styles.text}
        style={
          // pdf.js sizes the text from --total-scale-factor.
          /** @type {import('react').CSSProperties} */ ({
            width,
            height,
            '--total-scale-factor': scale,
          })
        }
      />
    </div>
  );
}
