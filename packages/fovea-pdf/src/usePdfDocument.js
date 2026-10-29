import { useCallback, useEffect, useState } from 'react';
import { useSource } from '@coldsofttech/fovea-viewers/core';
import { loadPdfjs } from './pdfjs.js';

/**
 * @typedef {import('./pdfjs.js').Pdfjs} Pdfjs
 * @typedef {import('pdfjs-dist').PDFDocumentProxy} PDFDocumentProxy
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} PdfState
 * @property {'loading' | 'password' | 'ready' | 'error'} status
 * @property {Pdfjs | null} pdfjs pdf.js, once the document is `ready`.
 * @property {PDFDocumentProxy | null} doc The document once `status` is `ready`.
 * @property {Error | null} error The failure once `status` is `error`.
 * @property {'needed' | 'incorrect' | null} reason Why a password is asked for.
 * @property {(password: string) => void} submitPassword Tries a password.
 */

/**
 * @typedef {object} Result
 * @property {Blob} blob
 * @property {PdfState['status']} status
 * @property {Pdfjs | null} [pdfjs]
 * @property {PDFDocumentProxy | null} [doc]
 * @property {Error | null} [error]
 * @property {'needed' | 'incorrect' | null} [reason]
 * @property {(password: string) => void} [update]
 */

/**
 * Loads a PDF and opens it with pdf.js. Asks for a password when the file needs one, and closes
 * the document when the source changes or the viewer goes away.
 *
 * @param {ViewerSource | null | undefined} source
 * @param {ViewerFetcher | undefined} fetcher
 * @param {{ password?: string, workerSrc?: string }} [options] `password` is tried first.
 * @returns {PdfState}
 */
export function usePdfDocument(source, fetcher, { password, workerSrc } = {}) {
  const loaded = useSource(source, fetcher);
  // The result remembers which file it is for, so a new file reads as loading during render.
  const [result, setResult] = useState(/** @type {Result | null} */ (null));
  const blob = loaded.blob;

  useEffect(() => {
    if (!blob) return undefined;
    let stopped = false;
    /** @type {import('pdfjs-dist').PDFDocumentLoadingTask | null} */
    let task = null;
    const settle = (/** @type {Omit<Result, 'blob'>} */ next) => {
      if (!stopped) setResult({ blob, ...next });
    };
    (async () => {
      try {
        const pdfjs = await loadPdfjs(workerSrc);
        const data = new Uint8Array(await blob.arrayBuffer());
        if (stopped) return;
        task = pdfjs.getDocument({ data, password });
        task.onPassword = (
          /** @type {(password: string) => void} */ update,
          /** @type {number} */ why,
        ) =>
          settle({
            status: 'password',
            reason: why === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? 'incorrect' : 'needed',
            update,
          });
        const doc = await task.promise;
        settle({ status: 'ready', pdfjs, doc });
      } catch (cause) {
        settle({
          status: 'error',
          error: cause instanceof Error ? cause : new Error(String(cause)),
        });
      }
    })();
    return () => {
      stopped = true;
      task?.destroy();
    };
  }, [blob, password, workerSrc]);

  const current = result && result.blob === blob ? result : null;
  const update = current?.update;
  const submitPassword = useCallback(
    (/** @type {string} */ typed) => {
      if (!blob) return;
      setResult({ blob, status: 'loading' });
      update?.(typed);
    },
    [blob, update],
  );

  /** @type {PdfState['status']} */
  let status = current?.status ?? 'loading';
  if (loaded.status === 'error') status = 'error';
  return {
    status,
    pdfjs: current?.pdfjs ?? null,
    doc: status === 'ready' ? (current?.doc ?? null) : null,
    error: loaded.error ?? current?.error ?? null,
    reason: current?.reason ?? null,
    submitPassword,
  };
}
