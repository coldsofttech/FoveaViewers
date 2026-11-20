import { useController } from '@coldsofttech/fovea-viewers/core';
import { createCodeViewer } from './vanilla/createCodeViewer.js';

export { codeMode } from './codeMode.js';

/**
 * @typedef {import('./vanilla/createCodeViewer.js').CodeViewerProps} CodeViewerProps
 * @typedef {import('./vanilla/createCodeViewer.js').Located} Located
 */

/**
 * A read-only view of a source file as Visual Studio Code would show it: line numbers and the
 * colours of its Light+ or Dark+ theme, with only the lines in view in the page. A match can be
 * found in the text shown (and under its key, for a file of `key: value` lines) and marked. The
 * drawing is done by `createCodeViewer` (see `@coldsofttech/fovea-code/vanilla`); this component
 * runs it.
 *
 * @param {CodeViewerProps} props
 */
export function CodeViewer(props) {
  const host = useController(createCodeViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
