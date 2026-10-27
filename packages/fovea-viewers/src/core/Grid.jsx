import { useMemo, useState } from 'react';

/**
 * @typedef {object} GridClassNames
 * @property {string} [root] The whole grid.
 * @property {string} [scroll] The scrolling area around the table.
 * @property {string} [table] The table.
 * @property {string} [headerCell] A header cell.
 * @property {string} [sortButton] The button in a sortable header cell.
 * @property {string} [cell] A body cell.
 * @property {string} [pager] The row of paging controls.
 */

/**
 * @typedef {object} GridSort
 * @property {number} column The column the rows are ordered by (from 0).
 * @property {'ascending' | 'descending'} direction
 */

/**
 * @typedef {object} GridProps
 * @property {string[]} columns The header of each column.
 * @property {string[][]} rows The body, one array of cells per row.
 * @property {GridClassNames} [classNames] Class names for each part, so the host decides the look.
 * @property {boolean} [sortable] Let a header be pressed to sort by its column. Defaults to true.
 * @property {number} [pageSize] How many rows are shown at once. Defaults to 100.
 * @property {string} [label] The accessible name of the table. Defaults to `Table`.
 * @property {(sort: GridSort | null) => void} [onSort] Called when the order changes, with `null`
 *   when it goes back to the original.
 */

/**
 * The number a cell holds, or `null` when it is not a number.
 *
 * @param {string} cell
 * @returns {number | null}
 */
function toNumber(cell) {
  const text = cell.trim();
  const value = Number(text);
  return text !== '' && Number.isFinite(value) ? value : null;
}

/**
 * Orders two cells: as numbers when both are numbers, and otherwise as text with digits in order.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareCells(a, b) {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x !== null && y !== null) return x - y;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * A table of text cells with sortable headers, and rows shown a page at a time. It has no styles
 * of its own: pass `classNames` to style it.
 *
 * @param {GridProps} props
 */
export function Grid({
  columns,
  rows,
  classNames = {},
  sortable = true,
  pageSize = 100,
  label = 'Table',
  onSort,
}) {
  // The order and page belong to one set of rows, and start again when the rows change.
  const [state, setState] = useState(
    /** @type {{ rows: string[][] | null, page: number, sort: { column: number, descending: boolean } | null }} */ ({
      rows: null,
      page: 0,
      sort: null,
    }),
  );
  const current = state.rows === rows ? state : { rows, page: 0, sort: null };
  const size = Math.max(1, Math.floor(pageSize) || 1);

  // Empty cells come last whichever way the order runs; equal cells keep their original order.
  const order = useMemo(() => {
    const indexes = rows.map((_, index) => index);
    if (!current.sort) return indexes;
    const { column, descending } = current.sort;
    return indexes.sort((x, y) => {
      const a = rows.at(x)?.at(column) ?? '';
      const b = rows.at(y)?.at(column) ?? '';
      if (a === '' || b === '') return a === b ? x - y : a === '' ? 1 : -1;
      return (descending ? -compareCells(a, b) : compareCells(a, b)) || x - y;
    });
  }, [rows, current.sort]);

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(current.page, pages - 1);
  const first = page * size;
  const shown = order.slice(first, first + size);

  // Each press on a header goes ascending, then descending, then back to the original order.
  /** @param {number} column */
  const press = (column) => {
    const was = current.sort?.column === column ? current.sort : null;
    const sort = !was
      ? { column, descending: false }
      : was.descending
        ? null
        : { column, descending: true };
    setState({ rows, page: 0, sort });
    onSort?.(sort ? { column, direction: sort.descending ? 'descending' : 'ascending' } : null);
  };

  return (
    <div className={classNames.root}>
      {/* A scrollable region must take focus so the keyboard can scroll it. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className={classNames.scroll} role="region" aria-label={label} tabIndex={0}>
        <table className={classNames.table}>
          <thead>
            <tr>
              {columns.map((name, column) => {
                const sorted = current.sort?.column === column ? current.sort : null;
                /** @type {'ascending' | 'descending' | 'none' | undefined} */
                let ariaSort;
                if (sortable)
                  ariaSort = sorted ? (sorted.descending ? 'descending' : 'ascending') : 'none';
                return (
                  <th
                    key={column}
                    scope="col"
                    className={classNames.headerCell}
                    aria-sort={ariaSort}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className={classNames.sortButton}
                        onClick={() => press(column)}
                      >
                        {name}
                        <span aria-hidden="true">
                          {sorted ? (sorted.descending ? ' ▼' : ' ▲') : ''}
                        </span>
                      </button>
                    ) : (
                      name
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((index) => (
              <tr key={index}>
                {columns.map((_, column) => (
                  <td key={column} className={classNames.cell}>
                    {rows.at(index)?.at(column) ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > size && (
        <div className={classNames.pager}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setState({ ...current, rows, page: page - 1 })}
          >
            Previous page
          </button>
          <span role="status">
            Rows {first + 1}–{first + shown.length} of {total}
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setState({ ...current, rows, page: page + 1 })}
          >
            Next page
          </button>
        </div>
      )}
    </div>
  );
}
