import { clearMarks, markIn } from '@coldsofttech/fovea-viewers/core/vanilla';
import styles from '../PdfViewer.module.css';

/**
 * @typedef {import('../pdfjs.js').Pdfjs} Pdfjs
 * @typedef {import('pdfjs-dist').PDFDocumentProxy} PDFDocumentProxy
 */

/** The most pixels a page's picture may have, so a high zoom cannot use up the browser's memory. */
const MAX_PIXELS = 16_000_000;

/**
 * @typedef {object} PageViewProps
 * @property {number} scale
 * @property {number} rotation The reader's turn, in degrees.
 * @property {number} width The page's width on screen.
 * @property {number} height The page's height on screen.
 * @property {{ matched: string, before?: string, after?: string } | null} mark Words to mark on
 *   this page.
 */

/**
 * One page: its picture, and over it the text a reader can select and find words in. It draws
 * itself when it appears and again when the zoom or turn changes, and stops when it goes.
 *
 * @param {object} options
 * @param {HTMLElement} options.parent Where the page goes.
 * @param {ReturnType<typeof import('@coldsofttech/fovea-viewers/core/vanilla').createH>} options.h
 * @param {Pdfjs} options.pdfjs
 * @param {PDFDocumentProxy} options.doc
 * @param {number} options.number The page's number, from 1.
 * @param {PageViewProps} options.props
 * @param {(number: number, size: { width: number, height: number }) => void} options.onSize Called
 *   with the page's own size, once it is known.
 * @param {(error: Error) => void} options.onError
 * @returns {{ element: HTMLElement, update: (next: PageViewProps) => void, destroy: () => void }}
 */
export function createPageView({ parent, h, pdfjs, doc, number, props, onSize, onError }) {
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', { class: styles.canvas, 'aria-hidden': 'true' })
  );
  const layer = h('div', { class: styles.text });
  const element = h(
    'div',
    { class: styles.page, role: 'group', 'aria-label': `Page ${number}`, 'data-page': number },
    canvas,
    layer,
  );
  parent.append(element);

  let current = props;
  // Counts the times the text has been drawn, so the words are marked again after each.
  let drawn = 0;
  let marked = '';
  let stopDrawing = () => {};
  const win = element.ownerDocument.defaultView;

  function size() {
    for (const target of [element, canvas, layer]) {
      target.style.width = `${current.width}px`;
      target.style.height = `${current.height}px`;
    }
    // pdf.js sizes the text from --total-scale-factor.
    layer.style.setProperty('--total-scale-factor', String(current.scale));
  }

  function draw() {
    stopDrawing();
    let stopped = false;
    /** @type {import('pdfjs-dist').RenderTask | null} */
    let painting = null;
    /** @type {import('pdfjs-dist').TextLayer | null} */
    let text = null;
    const { scale, rotation } = current;
    (async () => {
      try {
        const page = await doc.getPage(number);
        if (stopped) return;
        const own = page.getViewport({ scale: 1 });
        onSize(number, { width: own.width, height: own.height });
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        const ratio = Math.min(
          win?.devicePixelRatio || 1,
          Math.sqrt(MAX_PIXELS / (viewport.width * viewport.height)),
        );
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        painting = page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        layer.replaceChildren();
        text = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: layer,
          viewport,
        });
        await Promise.all([painting.promise, text.render()]);
        if (!stopped) {
          drawn++;
          markWords();
        }
      } catch (cause) {
        // Stopping a page part-way is not a failure.
        if (stopped) return;
        onError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    })();
    stopDrawing = () => {
      stopped = true;
      painting?.cancel();
      text?.cancel();
    };
  }

  /** Marks the words on this page once its text is there. */
  function markWords() {
    if (drawn === 0) return;
    const { mark } = current;
    const key = `${drawn}:${mark?.matched}:${mark?.before}:${mark?.after}`;
    if (key === marked) return;
    marked = key;
    clearMarks(layer);
    if (!mark) return;
    const first = markIn(layer, { matched: mark.matched, before: mark.before, after: mark.after });
    first?.scrollIntoView?.({ block: 'center' });
  }

  size();
  draw();

  return {
    element,
    update(next) {
      const redraw = next.scale !== current.scale || next.rotation !== current.rotation;
      current = next;
      size();
      if (redraw) draw();
      markWords();
    },
    destroy() {
      stopDrawing();
      element.remove();
    },
  };
}
