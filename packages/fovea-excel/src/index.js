export { ExcelViewer } from './ExcelViewer.jsx';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'excel',
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
  ],
  extensions: ['xlsx', 'xlsm'],
};
