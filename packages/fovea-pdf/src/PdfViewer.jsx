import { useEffect, useState } from 'react';
import { themeVars, useLatest } from '@coldsofttech/fovea-viewers/core';
import { Pages } from './Pages.jsx';
import { usePdfDocument } from './usePdfDocument.js';
import styles from './PdfViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 * @typedef {import('./layout.js').FitMode} FitMode
 */

/**
 * @typedef {object} PdfViewerProps
 * @property {ViewerSource} source The PDF: a URL, a Blob or File, or an ArrayBuffer.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours for the viewer around the
 *   pages. Pages are always drawn as the PDF says. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `PDF document`.
 * @property {string} [password] A password to try first, for a protected PDF. Without it, or when
 *   it is wrong, the viewer asks the reader.
 * @property {string} [workerSrc] The address of pdf.js's worker (`pdf.worker.min.mjs`). Defaults
 *   to the copy that comes with this package; set it for a bundler that cannot find that copy, or
 *   to serve the worker yourself.
 * @property {FitMode} [fit] How the pages are first sized: `width` (the default) or `page`.
 * @property {number} [initialPage] The page to open at, from 1. Defaults to 1.
 * @property {{ matched: string, before?: string, after?: string }} [target] Words to find: the
 *   page that holds them is scrolled to and the words are marked.
 * @property {(page: number | null) => void} [onLocated] Called with the number (from 1) of the
 *   page the target is on, or `null` when it is on none (or there is no target).
 * @property {(page: number) => void} [onPageChange] Called with the page the reader is on, as they
 *   scroll.
 * @property {(info: { pageCount: number }) => void} [onReady] Called when the PDF is shown.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/**
 * A viewer for a PDF: its pages one after another, drawn as they come into view, with text that
 * can be selected, zoom, fit, turning, page numbers, an outline, passwords and find-and-mark.
 *
 * @param {PdfViewerProps} props
 */
export function PdfViewer({
  source,
  fetcher,
  theme,
  label = 'PDF document',
  password,
  workerSrc,
  fit = 'width',
  initialPage = 1,
  target,
  onLocated,
  onPageChange,
  onReady,
  onError,
}) {
  const pdf = usePdfDocument(source, fetcher, { password, workerSrc });
  const [pageError, setPageError] = useState(/** @type {Error | null} */ (null));
  const [typed, setTyped] = useState('');
  const error = pdf.error ?? pageError;

  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  const doc = pdf.doc;
  useEffect(() => {
    if (doc) ready.current?.({ pageCount: doc.numPages });
  }, [doc, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  return (
    <div className={styles.root} style={themeVars(theme)} aria-busy={pdf.status === 'loading'}>
      {pdf.status === 'loading' && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The PDF could not be read: {error.message}
        </p>
      )}
      {pdf.status === 'password' && (
        <form
          className={styles.password}
          onSubmit={(event) => {
            event.preventDefault();
            pdf.submitPassword(typed);
            setTyped('');
          }}
        >
          <p role={pdf.reason === 'incorrect' ? 'alert' : 'status'}>
            {pdf.reason === 'incorrect'
              ? 'That password is not right. Try again.'
              : 'This PDF is protected. Enter its password to open it.'}
          </p>
          <label>
            Password{' '}
            <input
              type="password"
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>{' '}
          <button type="submit">Open</button>
        </form>
      )}
      {pdf.pdfjs && doc && (
        <Pages
          pdfjs={pdf.pdfjs}
          doc={doc}
          label={label}
          fit={fit}
          initialPage={initialPage}
          target={target}
          onLocated={onLocated}
          onPageChange={onPageChange}
          onError={setPageError}
        />
      )}
    </div>
  );
}
