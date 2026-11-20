import {
  applyTheme,
  createGrid,
  createShell,
  loadText,
} from '@coldsofttech/fovea-viewers/core/vanilla';
import { parseTable } from '../parseTable.js';
import styles from '../TableViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 */

/**
 * @typedef {object} TableViewerProps
 * @property {ViewerSource} source The file: a URL, a Blob or File, or an ArrayBuffer (UTF-8).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Table`.
 * @property {string} [delimiter] The character that separates cells, for example `;`. Found from
 *   the first line when not given (comma, tab, semicolon or bar).
 * @property {boolean} [header] Treat the first row as the column headers. Defaults to true;
 *   without it the columns are named `Column 1`, `Column 2` and so on.
 * @property {boolean} [sortable] Let a header be pressed to sort by its column. Defaults to true.
 * @property {number} [pageSize] How many rows are shown at once. Defaults to 100.
 * @property {(info: { rowCount: number, columnCount: number, delimiter: string }) => void} [onReady]
 *   Called when the table is shown. `rowCount` does not include the header row.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/**
 * @typedef {{ columns: string[], rows: string[][], delimiter: string }} Table
 */

/**
 * A viewer for a CSV or TSV file, drawn into a container: a table with sortable headers that stay
 * in view, and rows shown a page at a time.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {TableViewerProps} props
 * @returns {ViewerController}
 */
export function createTableViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;

  /** @type {'loading' | 'ready' | 'error'} */
  let status = 'loading';
  /** @type {string | null} */
  let text = null;
  /** @type {Error | null} */
  let loadError = null;
  /** @type {Table | null} */
  let table = null;
  /** @type {Error | null} */
  let parseError = null;
  /** @type {Table | null} */
  let reported = null;
  /** @type {Error | null} */
  let failed = null;
  /** @type {ViewerController | null} */
  let grid = null;
  /** @type {HTMLElement[]} */
  let messages = [];

  const gridProps = () => ({
    columns: /** @type {Table} */ (table).columns,
    rows: /** @type {Table} */ (table).rows,
    label: shell.props.label ?? 'Table',
    sortable: shell.props.sortable ?? true,
    pageSize: shell.props.pageSize ?? 100,
    classNames: {
      root: styles.grid,
      scroll: styles.scroll,
      table: styles.table,
      headerCell: styles.headerCell,
      sortButton: styles.sortButton,
      cell: styles.cell,
      pager: styles.pager,
    },
  });

  /** Reads the text again, for a new file or a new delimiter or header setting. */
  function parse() {
    table = null;
    parseError = null;
    if (text === null) return;
    try {
      const { delimiter, header = true } = shell.props;
      const { rows, delimiter: found } = parseTable(text, { delimiter });
      const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
      const names = (header ? rows[0] : null) ?? [];
      const columns = Array.from(
        { length: width },
        (_, i) => names.at(i)?.trim() || `Column ${i + 1}`,
      );
      table = { columns, rows: header ? rows.slice(1) : rows, delimiter: found };
    } catch (cause) {
      parseError = cause instanceof Error ? cause : new Error(String(cause));
    }
  }

  function render() {
    const error = loadError ?? parseError;
    root.setAttribute('aria-busy', String(status === 'loading'));

    for (const message of messages) message.remove();
    messages = [];
    if (status === 'loading')
      messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (error) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The table could not be read: ${error.message}`,
        ),
      );
    }
    if (table && table.columns.length === 0) {
      messages.push(h('p', { class: styles.message }, 'This file is empty.'));
    }
    root.prepend(...messages);

    if (table && table.columns.length > 0) {
      if (grid) grid.update(gridProps());
      else grid = createGrid(root, gridProps());
    } else if (grid) {
      grid.destroy();
      grid = null;
    }

    if (table && table !== reported) {
      shell.emit('onReady', {
        rowCount: table.rows.length,
        columnCount: table.columns.length,
        delimiter: table.delimiter,
      });
    }
    reported = table;
    if (error && error !== failed) shell.emit('onError', error);
    failed = error;
  }

  function reload() {
    status = 'loading';
    text = null;
    loadError = null;
    parse();
    render();
    shell.load((signal) => loadText(shell.props.source, { fetcher: shell.props.fetcher, signal }), {
      onResult(loaded) {
        status = 'ready';
        text = loaded;
        parse();
        render();
      },
      onError(error) {
        status = 'error';
        loadError = error;
        render();
      },
    });
  }

  shell.cleanup(() => grid?.destroy());
  applyTheme(root, props.theme);
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('source') || changed.includes('fetcher')) {
      reload();
    } else if (changed.includes('delimiter') || changed.includes('header')) {
      parse();
      render();
    } else {
      render();
    }
  });
  return shell.api;
}
