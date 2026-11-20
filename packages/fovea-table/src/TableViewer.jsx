import { useController } from '@coldsofttech/fovea-viewers/core';
import { createTableViewer } from './vanilla/createTableViewer.js';

/**
 * @typedef {import('./vanilla/createTableViewer.js').TableViewerProps} TableViewerProps
 */

/**
 * A viewer for a CSV or TSV file: a table with sortable headers that stay in view, and rows shown
 * a page at a time. The drawing is done by `createTableViewer` (see
 * `@coldsofttech/fovea-table/vanilla`); this component runs it.
 *
 * @param {TableViewerProps} props
 */
export function TableViewer(props) {
  const host = useController(createTableViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
