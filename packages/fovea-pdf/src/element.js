import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createPdfViewer } from './vanilla/createPdfViewer.js';

/**
 * Registers `<fovea-pdf>`, the PDF viewer as a Web Component. Importing this file registers it;
 * call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `password`, `worker-src` (the address
 * of pdf.js's worker, when the bundler cannot find the copy that comes with this package), `fit`
 * (`width` or `page`) and `initial-page`. Properties: those, plus `source` (a URL, `Blob`, `File`
 * or `ArrayBuffer`), `fetcher`, `target` and `theme` (also an object of colours). Events:
 * `fovea-ready` (`detail.pageCount`), `fovea-located` (`detail` is the page the target is on, from
 * 1, or `null`), `fovea-page-change` (`detail` is the page the reader is on) and `fovea-error`
 * (`detail` is the `Error`).
 */
export const definePdfElement = defineViewerElement({
  tag: 'fovea-pdf',
  create: createPdfViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    password: 'password',
    'worker-src': 'workerSrc',
    fit: 'fit',
    'initial-page': ['initialPage', 'number'],
  },
  properties: ['fetcher', 'target'],
  events: {
    onReady: 'fovea-ready',
    onLocated: 'fovea-located',
    onPageChange: 'fovea-page-change',
    onError: 'fovea-error',
  },
});

definePdfElement();
