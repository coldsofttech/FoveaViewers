import { useController } from '@coldsofttech/fovea-viewers/core';
import { createLineViewer } from './vanilla/createLineViewer.js';

/**
 * @typedef {import('./vanilla/createLineViewer.js').LineViewerProps} LineViewerProps
 * @typedef {import('./vanilla/createLineViewer.js').LineTokens} LineTokens
 */

/**
 * A read-only view of lines of text with line numbers. Only the lines in view are in the page, so
 * a file of hundreds of thousands of lines opens at once. Lines do not wrap; a long one scrolls
 * sideways. This is what `TextViewer` shows once it has read a file, and what the code viewer
 * builds on.
 *
 * The drawing is done by `createLineViewer` (see `@coldsofttech/fovea-text/vanilla`); this
 * component runs it.
 *
 * @param {LineViewerProps} props
 */
export function LineViewer(props) {
  const host = useController(createLineViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
