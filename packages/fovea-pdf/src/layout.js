/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */

/** The smallest and largest zoom, as a multiple of a page's own size. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5;

/** How much one press of a zoom button or key changes the zoom. */
export const ZOOM_STEP = 1.25;

/** Space between pages, and around them, in pixels. */
export const GAP = 12;

/**
 * @typedef {'width' | 'page'} FitMode
 * `width` makes a page as wide as the view; `page` makes a whole page fit in it.
 */

/**
 * @typedef {object} Size
 * @property {number} width
 * @property {number} height
 */

/**
 * Keeps a zoom between the smallest and the largest.
 *
 * @param {number} zoom
 * @returns {number}
 */
export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/**
 * A quarter turn from a rotation in degrees (0, 90, 180 or 270).
 *
 * @param {number} rotation
 * @param {1 | -1} direction 1 turns right, -1 turns left.
 * @returns {number}
 */
export const turn = (rotation, direction) => (rotation + direction * 90 + 360) % 360;

/**
 * The size a page has on screen.
 *
 * @param {Size} size The page's own size.
 * @param {number} scale
 * @param {number} rotation The reader's turn, in degrees.
 * @returns {Size}
 */
export function boxOf(size, scale, rotation) {
  const turned = rotation % 180 !== 0;
  return {
    width: (turned ? size.height : size.width) * scale,
    height: (turned ? size.width : size.height) * scale,
  };
}

/**
 * The zoom a fit mode gives a page in a view.
 *
 * @param {FitMode} mode
 * @param {Size} page The page's size at zoom 1, after any turn.
 * @param {Size} view
 * @returns {number}
 */
export function fitZoom(mode, page, view) {
  const room = { width: view.width - GAP * 2, height: view.height - GAP * 2 };
  if (page.width <= 0 || page.height <= 0 || room.width <= 0 || room.height <= 0) return 1;
  const wide = room.width / page.width;
  return clampZoom(mode === 'width' ? wide : Math.min(wide, room.height / page.height));
}

/**
 * Where each page starts, from the top of the pages, and how tall they all are together.
 *
 * @param {number[]} heights The height of each page.
 * @returns {{ tops: number[], total: number }}
 */
export function stack(heights) {
  /** @type {number[]} */
  const tops = [];
  let y = GAP;
  for (const height of heights) {
    tops.push(y);
    y += height + GAP;
  }
  return { tops, total: y };
}

/**
 * The page at a height: the last one that starts at or above it.
 *
 * @param {number[]} tops
 * @param {number} y
 * @returns {number} An index from 0.
 */
export function pageAt(tops, y) {
  let low = 0;
  let high = tops.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (tops[middle] <= y) low = middle;
    else high = middle - 1;
  }
  return Math.max(0, low);
}

/**
 * The pages that touch a stretch of the stack.
 *
 * @param {number[]} tops
 * @param {number[]} heights
 * @param {number} from
 * @param {number} to
 * @returns {number[]} Indexes from 0.
 */
export function pagesIn(tops, heights, from, to) {
  if (tops.length === 0) return [];
  /** @type {number[]} */
  const found = [];
  for (let i = pageAt(tops, from); i < tops.length && tops[i] <= to; i++) {
    if (tops[i] + heights[i] >= from) found.push(i);
  }
  return found;
}
