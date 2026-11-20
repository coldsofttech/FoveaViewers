import { useController } from '@coldsofttech/fovea-viewers/core';
import { createTextViewer } from './vanilla/createTextViewer.js';

/**
 * @typedef {import('./vanilla/createTextViewer.js').TextViewerProps} TextViewerProps
 */

/**
 * A read-only view of a text file with line numbers. Only the lines in view are in the page, so
 * a file of hundreds of thousands of lines opens at once. Lines do not wrap; a long one scrolls
 * sideways.
 *
 * The drawing is done by `createTextViewer` (see `@coldsofttech/fovea-text/vanilla`); this
 * component runs it.
 *
 * @param {TextViewerProps} props
 */
export function TextViewer(props) {
  const host = useController(createTextViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
