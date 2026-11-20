import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createTableViewer } from './vanilla/createTableViewer.js';

/**
 * Registers `<fovea-table>`, the CSV and TSV viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `delimiter`, `header` and `sortable`
 * (both on by default: `header="false"` and `sortable="false"` turn them off) and `page-size`.
 * Properties: those, plus `source` (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher` and `theme`
 * (also an object of colours). Events: `fovea-ready` (`detail` has `rowCount`, `columnCount` and
 * `delimiter`) and `fovea-error` (`detail` is the `Error`).
 */
export const defineTableElement = defineViewerElement({
  tag: 'fovea-table',
  create: createTableViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    delimiter: 'delimiter',
    header: ['header', 'boolean'],
    sortable: ['sortable', 'boolean'],
    'page-size': ['pageSize', 'number'],
  },
  properties: ['fetcher'],
  events: { onReady: 'fovea-ready', onError: 'fovea-error' },
});

defineTableElement();
