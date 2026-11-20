import { useController } from './useController.js';
import { createGrid } from './vanilla/grid.js';

export { compareCells } from './vanilla/grid.js';

/**
 * @typedef {import('./vanilla/grid.js').GridClassNames} GridClassNames
 * @typedef {import('./vanilla/grid.js').GridSort} GridSort
 * @typedef {import('./vanilla/grid.js').GridCell} GridCell
 * @typedef {import('./vanilla/grid.js').GridProps} GridProps
 */

/**
 * A table of text cells with sortable headers, and rows shown a page at a time. It has no styles
 * of its own: pass `classNames` to style it. The drawing is done by `createGrid` (see
 * `@coldsofttech/fovea-viewers/core/vanilla`); this component runs it.
 *
 * @param {GridProps} props
 */
export function Grid(props) {
  const host = useController(createGrid, props);
  // The wrapper takes no space, so the grid sits where its parent's layout expects it.
  return <div ref={host} style={{ display: 'contents' }} />;
}
