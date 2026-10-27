import { useEffect, useMemo } from 'react';
import { Grid, themeVars, useLatest, useText } from '@coldsofttech/fovea-viewers/core';
import { parseTable } from './parseTable.js';
import styles from './TableViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
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
 * A viewer for a CSV or TSV file: a table with sortable headers that stay in view, and rows shown
 * a page at a time.
 *
 * @param {TableViewerProps} props
 */
export function TableViewer({
  source,
  fetcher,
  theme,
  label = 'Table',
  delimiter,
  header = true,
  sortable = true,
  pageSize = 100,
  onReady,
  onError,
}) {
  const { status, text, error: loadError } = useText(source, fetcher);

  const parsed = useMemo(() => {
    if (text === null) return null;
    try {
      const { rows, delimiter: found } = parseTable(text, { delimiter });
      const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
      const names = (header ? rows[0] : null) ?? [];
      const columns = Array.from(
        { length: width },
        (_, i) => names.at(i)?.trim() || `Column ${i + 1}`,
      );
      return {
        table: { columns, rows: header ? rows.slice(1) : rows, delimiter: found },
        error: null,
      };
    } catch (cause) {
      return { table: null, error: cause instanceof Error ? cause : new Error(String(cause)) };
    }
  }, [text, delimiter, header]);
  const table = parsed?.table ?? null;
  const error = loadError ?? parsed?.error ?? null;

  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  useEffect(() => {
    if (table) {
      ready.current?.({
        rowCount: table.rows.length,
        columnCount: table.columns.length,
        delimiter: table.delimiter,
      });
    }
  }, [table, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  return (
    <div className={styles.root} style={themeVars(theme)} aria-busy={status === 'loading'}>
      {status === 'loading' && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The table could not be read: {error.message}
        </p>
      )}
      {table && table.columns.length === 0 && <p className={styles.message}>This file is empty.</p>}
      {table && table.columns.length > 0 && (
        <Grid
          columns={table.columns}
          rows={table.rows}
          label={label}
          sortable={sortable}
          pageSize={pageSize}
          classNames={{
            root: styles.grid,
            scroll: styles.scroll,
            table: styles.table,
            headerCell: styles.headerCell,
            sortButton: styles.sortButton,
            cell: styles.cell,
            pager: styles.pager,
          }}
        />
      )}
    </div>
  );
}
