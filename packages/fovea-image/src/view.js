/** The smallest and largest zoom, as a multiple of the image's own size. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

/** How much one press of a zoom button or key changes the zoom. */
export const ZOOM_STEP = 1.25;

/**
 * @typedef {'contain' | 'width' | 'actual'} FitMode
 * `contain` shrinks the image to fit the view (never enlarging it), `width` fits its width to the
 * view, and `actual` shows it at its own size.
 */

/**
 * Keeps a zoom between the smallest and the largest.
 *
 * @param {number} zoom
 * @returns {number}
 */
export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/**
 * The zoom that a fit mode gives an image in a view.
 *
 * @param {FitMode} mode
 * @param {number} width The image's width (after any turn).
 * @param {number} height The image's height (after any turn).
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @returns {number}
 */
export function fitScale(mode, width, height, viewWidth, viewHeight) {
  if (mode === 'actual' || width <= 0 || height <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return 1;
  }
  if (mode === 'width') return clampZoom(viewWidth / width);
  return clampZoom(Math.min(1, viewWidth / width, viewHeight / height));
}

/**
 * Keeps an image's offset on one axis within what is needed to reach all of it. An image smaller
 * than the view stays centred.
 *
 * @param {number} offset
 * @param {number} extent The image's size on this axis, before zoom.
 * @param {number} scale
 * @param {number} room The view's size on this axis.
 * @returns {number}
 */
export function clampPan(offset, extent, scale, room) {
  const limit = Math.max(0, (extent * scale - room) / 2);
  return Math.min(limit, Math.max(-limit, offset));
}

/**
 * A quarter turn from a rotation in degrees (0, 90, 180 or 270).
 *
 * @param {number} rotation
 * @param {1 | -1} direction 1 turns right, -1 turns left.
 * @returns {number}
 */
export const turn = (rotation, direction) => (rotation + direction * 90 + 360) % 360;

/**
 * A size in bytes for people.
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
