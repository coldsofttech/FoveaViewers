import { applyTheme, createShell, loadSource } from '@coldsofttech/fovea-viewers/core/vanilla';
import { loadPdfjs } from '../pdfjs.js';
import { createPages } from './pages.js';
import styles from '../PdfViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../layout.js').FitMode} FitMode
 * @typedef {import('../pdfjs.js').Pdfjs} Pdfjs
 * @typedef {import('pdfjs-dist').PDFDocumentProxy} PDFDocumentProxy
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
 * A viewer for a PDF, drawn into a container: its pages one after another, drawn as they come into
 * view, with text that can be selected, zoom, fit, turning, page numbers, an outline, passwords and
 * find-and-mark.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {PdfViewerProps} props
 * @returns {ViewerController}
 */
export function createPdfViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;

  /** @type {'loading' | 'password' | 'ready' | 'error'} */
  let status = 'loading';
  /** @type {Blob | null} */
  let blob = null;
  /** @type {Pdfjs | null} */
  let pdfjs = null;
  /** @type {PDFDocumentProxy | null} */
  let doc = null;
  /** @type {Error | null} */
  let loadError = null;
  /** @type {Error | null} */
  let pageError = null;
  /** @type {'needed' | 'incorrect' | null} */
  let reason = null;
  /** @type {((password: string) => void) | null} */
  let answer = null;
  /** @type {HTMLElement[]} */
  let messages = [];
  /** @type {HTMLElement | null} */
  let form = null;
  /** @type {{ doc: PDFDocumentProxy, controller: { update: Function, destroy: () => void } } | null} */
  let pages = null;
  /** @type {() => void} */
  let closeDocument = () => {};
  /** @type {PDFDocumentProxy | null} */
  let reportedDoc = null;
  /** @type {Error | null} */
  let failed = null;
  let opening = 0;

  /** @returns {Error | null} */
  const error = () => loadError ?? pageError;

  /** Loads the PDF into pdf.js. Asks for a password when the file needs one. */
  function openDocument() {
    closeDocument();
    if (!blob) return;
    const file = blob;
    const mine = ++opening;
    let stopped = false;
    /** @type {import('pdfjs-dist').PDFDocumentLoadingTask | null} */
    let task = null;
    closeDocument = () => {
      stopped = true;
      task?.destroy();
    };
    status = 'loading';
    doc = null;
    pdfjs = null;
    loadError = null;
    pageError = null;
    reason = null;
    answer = null;
    render();
    (async () => {
      try {
        const library = await loadPdfjs(shell.props.workerSrc);
        const data = new Uint8Array(await file.arrayBuffer());
        if (stopped) return;
        task = library.getDocument({ data, password: shell.props.password });
        task.onPassword = (
          /** @type {(password: string) => void} */ update,
          /** @type {number} */ why,
        ) => {
          if (stopped || mine !== opening) return;
          status = 'password';
          reason = why === library.PasswordResponses.INCORRECT_PASSWORD ? 'incorrect' : 'needed';
          answer = update;
          render();
        };
        const opened = await task.promise;
        if (stopped || mine !== opening) return;
        status = 'ready';
        pdfjs = library;
        doc = opened;
        render();
      } catch (cause) {
        if (stopped || mine !== opening) return;
        status = 'error';
        loadError = cause instanceof Error ? cause : new Error(String(cause));
        render();
      }
    })();
  }

  function pagesProps() {
    const { label = 'PDF document', fit = 'width', initialPage = 1, target } = shell.props;
    return {
      label,
      fit,
      initialPage,
      target,
      onLocated: (/** @type {number | null} */ page) => shell.emit('onLocated', page),
      onPageChange: (/** @type {number} */ page) => shell.emit('onPageChange', page),
      onError: (/** @type {Error} */ failure) => {
        pageError = failure;
        render();
      },
    };
  }

  function render() {
    const failure = error();
    root.setAttribute('aria-busy', String(status === 'loading'));

    for (const message of messages) message.remove();
    messages = [];
    if (status === 'loading')
      messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (failure) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The PDF could not be read: ${failure.message}`,
        ),
      );
    }
    root.prepend(...messages);

    form?.remove();
    form = null;
    if (status === 'password') {
      const input = /** @type {HTMLInputElement} */ (
        h('input', { type: 'password', autocomplete: 'off' })
      );
      form = h(
        'form',
        {
          class: styles.password,
          onsubmit: (/** @type {Event} */ event) => {
            event.preventDefault();
            const typed = input.value;
            status = 'loading';
            render();
            answer?.(typed);
          },
        },
        h(
          'p',
          { role: reason === 'incorrect' ? 'alert' : 'status' },
          reason === 'incorrect'
            ? 'That password is not right. Try again.'
            : 'This PDF is protected. Enter its password to open it.',
        ),
        h('label', null, 'Password ', input),
        ' ',
        h('button', { type: 'submit' }, 'Open'),
      );
      root.append(form);
    }

    if (pdfjs && doc) {
      if (pages && pages.doc !== doc) {
        pages.controller.destroy();
        pages = null;
      }
      if (pages) pages.controller.update(pagesProps());
      else
        pages = {
          doc,
          controller: createPages({ parent: root, h, pdfjs, doc, props: pagesProps() }),
        };
    } else if (pages) {
      pages.controller.destroy();
      pages = null;
    }

    if (doc && doc !== reportedDoc) shell.emit('onReady', { pageCount: doc.numPages });
    reportedDoc = doc;
    if (failure && failure !== failed) shell.emit('onError', failure);
    failed = failure;
  }

  function reload() {
    closeDocument();
    blob = null;
    status = 'loading';
    doc = null;
    pdfjs = null;
    loadError = null;
    pageError = null;
    render();
    shell.load(
      (signal) => loadSource(shell.props.source, { fetcher: shell.props.fetcher, signal }),
      {
        onResult(loaded) {
          blob = loaded;
          openDocument();
        },
        onError(failure) {
          status = 'error';
          loadError = failure;
          render();
        },
      },
    );
  }

  shell.cleanup(() => {
    closeDocument();
    pages?.controller.destroy();
    pages = null;
  });
  applyTheme(root, props.theme);
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('source') || changed.includes('fetcher')) {
      reload();
    } else if (changed.includes('password') || changed.includes('workerSrc')) {
      openDocument();
    } else {
      render();
    }
  });
  return shell.api;
}
