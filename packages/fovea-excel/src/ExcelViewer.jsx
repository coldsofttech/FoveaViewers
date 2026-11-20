import { useController } from '@coldsofttech/fovea-viewers/core';
import { createExcelViewer } from './vanilla/createExcelViewer.js';

/**
 * @typedef {import('./vanilla/createExcelViewer.js').ExcelViewerProps} ExcelViewerProps
 */

/**
 * A viewer for an Excel workbook: a tab for each sheet and the sheet as a table, with the cell
 * styles, merged cells and column widths of the file, and rows shown a page at a time. The drawing
 * is done by `createExcelViewer` (see `@coldsofttech/fovea-excel/vanilla`); this component runs it.
 *
 * @param {ExcelViewerProps} props
 */
export function ExcelViewer(props) {
  const host = useController(createExcelViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
