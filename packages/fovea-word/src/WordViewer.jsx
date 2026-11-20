import { useController } from '@coldsofttech/fovea-viewers/core';
import { createWordViewer } from './vanilla/createWordViewer.js';

/**
 * @typedef {import('./vanilla/createWordViewer.js').WordViewerProps} WordViewerProps
 */

/**
 * A viewer for a Word document: its text, headings, lists, tables, links and pictures, shown in a
 * frame that lets nothing in unless the host allows it. Fonts, page layout, headers and footers are
 * not kept. The drawing is done by `createWordViewer` (see `@coldsofttech/fovea-word/vanilla`);
 * this component runs it.
 *
 * @param {WordViewerProps} props
 */
export function WordViewer(props) {
  const host = useController(createWordViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
