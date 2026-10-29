export { TableViewer } from './TableViewer.jsx';
export { parseTable } from './parseTable.js';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'table',
  mimeTypes: ['text/csv', 'text/tab-separated-values'],
  extensions: ['csv', 'tsv'],
};
