import { createShell } from './shell.js';

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
 * @typedef {object} GridCell
 * @property {object} [style] Styles for the cell: an object of CSS values by property name in
 *   camelCase (`backgroundColor`) or as a custom property (`--x`).
 * @property {number} [colSpan] How many columns the cell covers.
 * @property {number} [rowSpan] How many rows the cell covers. Counted in the order the rows are
 *   shown, so a grid with spans must not be sortable.
 * @property {number} [coveredBy] The row of the cell that covers this one. This cell is left out
 *   while that row is shown, so a merged cell is drawn once.
 */

/**
 * @typedef {object} GridProps
 * @property {string[]} columns The header of each column.
 * @property {string[][]} rows The body, one array of cells per row.
 * @property {GridClassNames} [classNames] Class names for each part, so the host decides the look.
 * @property {boolean} [sortable] Let a header be pressed to sort by its column. Defaults to true.
 * @property {number} [pageSize] How many rows are shown at once. Defaults to 100.
 * @property {string} [label] The accessible name of the table. Defaults to `Table`.
 * @property {(row: number, column: number) => GridCell | undefined} [cellProps] Styles and spans
 *   for a body cell. `row` is the row's place in `rows`, whatever order it is shown in.
 * @property {(string | undefined)[]} [columnWidths] A CSS width for each column.
 * @property {{ row: number, key: string }} [reveal] A row to bring into view by showing its page.
 *   It is shown once for each `key`; after that the reader is in charge of the page.
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
 * A table of text cells with sortable headers, and rows shown a page at a time, drawn into a
 * container. It has no styles of its own: pass `classNames` to style it.
 *
 * The header and the paging buttons stay in the page while the reader sorts and pages, so the one
 * they pressed keeps the keyboard focus; the body is drawn again.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {GridProps} props
 * @returns {import('./shell.js').ViewerController}
 */
export function createGrid(container, props) {
  const shell = createShell(container, props, {
    required: ['columns', 'rows'],
    className: props.classNames?.root,
  });
  const { root, h } = shell;
  /** The current props, as the grid's own. */
  const gridProps = () => /** @type {GridProps} */ (shell.props);

  // The order and page belong to one set of rows, and start again when the rows change.
  /** @type {{ page: number, sort: { column: number, descending: boolean } | null, revealed?: string }} */
  let state = { page: 0, sort: null };
  /** @type {string[][]} */
  let stateRows = props.rows;
  /** @type {number[] | null} */
  let order = null;
  /** @type {{ rows: string[][], sort: unknown } | null} */
  let orderKey = null;

  const scroll = h('div', { role: 'region', tabindex: '0' });
  const table = h('table');
  const head = h('tr');
  const body = h('tbody');
  table.append(h('thead', null, head), body);
  scroll.append(table);
  root.append(scroll);
  /** @type {HTMLElement | null} */
  let colgroup = null;
  /** @type {{ box: HTMLElement, previous: HTMLButtonElement, status: HTMLElement, next: HTMLButtonElement } | null} */
  let pager = null;
  /** @type {Array<{ cell: HTMLElement, button: HTMLElement | null, arrow: HTMLElement | null }>} */
  let headers = [];
  let headerKey = '';
  /** @type {{ rows: string[][], shown: string, columns: number, cell: string | undefined, extras: string } | null} */
  let bodySignature = null;

  const classes = () => gridProps().classNames ?? {};

  /** Empty cells come last whichever way the order runs; equal cells keep their original order. */
  function ordered() {
    const { rows } = gridProps();
    if (order && orderKey && orderKey.rows === rows && orderKey.sort === state.sort) return order;
    const indexes = rows.map((_, index) => index);
    if (state.sort) {
      const { column, descending } = state.sort;
      indexes.sort((x, y) => {
        const a = rows.at(x)?.at(column) ?? '';
        const b = rows.at(y)?.at(column) ?? '';
        if (a === '' || b === '') return a === b ? x - y : a === '' ? 1 : -1;
        return (descending ? -compareCells(a, b) : compareCells(a, b)) || x - y;
      });
    }
    order = indexes;
    orderKey = { rows, sort: state.sort };
    return indexes;
  }

  /** Each press on a header goes ascending, then descending, then back to the original order. */
  /** @param {number} column */
  function press(column) {
    const was = state.sort?.column === column ? state.sort : null;
    const sort = !was
      ? { column, descending: false }
      : was.descending
        ? null
        : { column, descending: true };
    state = { page: 0, sort, revealed: gridProps().reveal?.key };
    render();
    shell.emit(
      'onSort',
      sort ? { column, direction: sort.descending ? 'descending' : 'ascending' } : null,
    );
  }

  /** @param {number} delta */
  function turn(delta) {
    state = { ...state, page: currentPage().page + delta, revealed: gridProps().reveal?.key };
    render();
  }

  function currentPage() {
    const { rows, reveal } = gridProps();
    const size = Math.max(1, Math.floor(gridProps().pageSize ?? 100) || 1);
    const sequence = ordered();
    const pages = Math.max(1, Math.ceil(rows.length / size));
    // A row to reveal sets the page once, until the reader moves it.
    const revealing = reveal && state.revealed !== reveal.key ? sequence.indexOf(reveal.row) : -1;
    const page = Math.min(revealing >= 0 ? Math.floor(revealing / size) : state.page, pages - 1);
    return { page, pages, size, sequence };
  }

  /** The header row: made again only when what it is made from changes. */
  function buildHeader() {
    const { columns, sortable = true, columnWidths } = gridProps();
    const key = JSON.stringify([
      columns,
      sortable,
      columnWidths,
      classes().headerCell,
      classes().sortButton,
    ]);
    if (key === headerKey) return;
    headerKey = key;
    colgroup?.remove();
    colgroup = null;
    if (columnWidths?.some(Boolean)) {
      colgroup = h('colgroup');
      columns.forEach((_, column) => {
        const col = h('col');
        const width = columnWidths.at(column);
        if (width) col.style.width = width;
        colgroup?.append(col);
      });
      table.prepend(colgroup);
    }
    headers = columns.map((name, column) => {
      const cell = h('th', { scope: 'col', class: classes().headerCell });
      if (!sortable) {
        cell.append(name);
        return { cell, button: null, arrow: null };
      }
      const arrow = h('span', { 'aria-hidden': 'true' });
      const button = h(
        'button',
        { type: 'button', class: classes().sortButton, onclick: () => press(column) },
        name,
        arrow,
      );
      cell.append(button);
      return { cell, button, arrow };
    });
    head.replaceChildren(...headers.map(({ cell }) => cell));
  }

  function render() {
    const { rows, columns, sortable = true, cellProps } = gridProps();
    buildHeader();
    scroll.className = classes().scroll ?? '';
    table.className = classes().table ?? '';
    scroll.setAttribute('aria-label', gridProps().label ?? 'Table');

    headers.forEach(({ cell, arrow }, column) => {
      if (!sortable) return;
      const sorted = state.sort?.column === column ? state.sort : null;
      cell.setAttribute(
        'aria-sort',
        sorted ? (sorted.descending ? 'descending' : 'ascending') : 'none',
      );
      if (arrow) arrow.textContent = sorted ? (sorted.descending ? ' ▼' : ' ▲') : '';
    });

    const { page, pages, size, sequence } = currentPage();
    const first = page * size;
    const shown = sequence.slice(first, first + size);

    // What each cell needs besides its text. The body is only drawn again when something it is made
    // of has changed, so what a host did to its cells (marking words in them) survives a render
    // that changed nothing, as it did when React kept the cells in place.
    const extras = shown.map((index) => columns.map((_, column) => cellProps?.(index, column)));
    const signature = {
      rows,
      shown: shown.join(','),
      columns: columns.length,
      cell: classes().cell,
      extras: JSON.stringify(extras),
    };
    const unchanged =
      bodySignature &&
      bodySignature.rows === signature.rows &&
      bodySignature.shown === signature.shown &&
      bodySignature.columns === signature.columns &&
      bodySignature.cell === signature.cell &&
      bodySignature.extras === signature.extras;
    if (!unchanged) {
      bodySignature = signature;
      body.replaceChildren(
        ...shown.map((index, position) => {
          const tr = h('tr');
          columns.forEach((_, column) => {
            const extra = extras.at(position)?.at(column);
            // A cell covered by a merged one is left out, unless the merged one is not on this
            // page, where it would leave a gap.
            if (extra?.coveredBy !== undefined && shown.includes(extra.coveredBy)) return;
            const rowSpan = extra?.rowSpan
              ? Math.min(extra.rowSpan, shown.length - position)
              : undefined;
            const td = h('td', {
              class: classes().cell,
              colspan: extra?.colSpan && extra.colSpan > 1 ? extra.colSpan : null,
              rowspan: rowSpan && rowSpan > 1 ? rowSpan : null,
            });
            for (const [name, value] of Object.entries(extra?.style ?? {})) {
              if (name.startsWith('--')) td.style.setProperty(name, String(value));
              // eslint-disable-next-line security/detect-object-injection -- a CSS property name from the host's own cellProps.
              else /** @type {any} */ (td.style)[name] = value;
            }
            td.textContent = rows.at(index)?.at(column) ?? '';
            tr.append(td);
          });
          return tr;
        }),
      );
    }

    if (rows.length > size) {
      if (!pager) {
        const previous = /** @type {HTMLButtonElement} */ (
          h('button', { type: 'button', onclick: () => turn(-1) }, 'Previous page')
        );
        const next = /** @type {HTMLButtonElement} */ (
          h('button', { type: 'button', onclick: () => turn(1) }, 'Next page')
        );
        const status = h('span', { role: 'status' });
        const box = h('div', null, previous, status, next);
        root.append(box);
        pager = { box, previous, status, next };
      }
      pager.box.className = classes().pager ?? '';
      pager.previous.disabled = page === 0;
      pager.next.disabled = page >= pages - 1;
      pager.status.textContent = `Rows ${first + 1}–${first + shown.length} of ${rows.length}`;
    } else if (pager) {
      pager.box.remove();
      pager = null;
    }
  }

  shell.onUpdate((changed) => {
    if (gridProps().rows !== stateRows) {
      stateRows = gridProps().rows;
      state = { page: 0, sort: null };
    }
    if (changed.includes('classNames')) root.className = classes().root ?? '';
    render();
  });
  render();
  return shell.api;
}
