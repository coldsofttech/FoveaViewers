import { useController } from '@coldsofttech/fovea-viewers/core';
import { createImageViewer } from './vanilla/createImageViewer.js';

/**
 * @typedef {import('./vanilla/createImageViewer.js').ImageViewerProps} ImageViewerProps
 */

/**
 * A viewer for an image: it fits the image to the view, and can zoom (buttons, keys and the mouse
 * wheel), pan by dragging or with the arrow keys, and turn it in quarter turns. SVG is shown as a
 * picture, so its scripts never run.
 *
 * The drawing is done by `createImageViewer` (see `@coldsofttech/fovea-image/vanilla`); this
 * component runs it.
 *
 * @param {ImageViewerProps} props
 */
export function ImageViewer(props) {
  const host = useController(createImageViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
