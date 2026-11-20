import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createExcelViewer } from './vanilla/createExcelViewer.js';

/**
 * Registers `<fovea-excel>`, the Excel workbook viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `sheet` (a sheet name), `show-formulas`,
 * `sortable` (on by default: `sortable="false"` turns it off) and `page-size`. Properties: those,
 * plus `source` (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher`, `target`, `theme` (also an
 * object of colours) and `sheet` (also a place, from 0). Events: `fovea-ready` (`detail.sheets`,
 * the sheet names), `fovea-sheet-change` (`detail` has `name` and `index`), `fovea-marked`
 * (`detail` is whether the target's words were marked, or `null`) and `fovea-error` (`detail` is
 * the `Error`).
 */
export const defineExcelElement = defineViewerElement({
  tag: 'fovea-excel',
  create: createExcelViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    sheet: 'sheet',
    'show-formulas': ['showFormulas', 'boolean'],
    sortable: ['sortable', 'boolean'],
    'page-size': ['pageSize', 'number'],
  },
  properties: ['fetcher', 'target'],
  events: {
    onReady: 'fovea-ready',
    onSheetChange: { name: 'fovea-sheet-change', detail: (name, index) => ({ name, index }) },
    onMarked: 'fovea-marked',
    onError: 'fovea-error',
  },
});

defineExcelElement();
