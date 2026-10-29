/**
 * @typedef {typeof import('pdfjs-dist')} Pdfjs
 */

/** @type {Promise<Pdfjs> | null} */
let loading = null;

/**
 * Loads pdf.js the first time a PDF is opened, so a page that never shows one never pays for it,
 * and tells it where its worker is: `workerSrc`, or the copy that is built next to this file (see vite.config.js).
 *
 * @param {string} [workerSrc]
 * @returns {Promise<Pdfjs>}
 */
export function loadPdfjs(workerSrc) {
  loading ??= import('pdfjs-dist');
  return loading.then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc =
      workerSrc ?? new URL(/* @vite-ignore */ './pdf.worker.min.mjs', import.meta.url).href;
    return pdfjs;
  });
}
