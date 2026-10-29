import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Grid,
  clearMarks,
  markIn,
  themeVars,
  useLatest,
  useSource,
} from '@coldsofttech/fovea-viewers/core';
import { locate, parseWorkbook } from './parseWorkbook.js';
import styles from './ExcelViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 */

/**
 * @typedef {object} ExcelViewerProps
 * @property {ViewerSource} source The workbook: a URL, a Blob or File, or an ArrayBuffer (`.xlsx`
 *   or `.xlsm`; macros are never run).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Workbook`.
 * @property {string | number} [sheet] The sheet to show, by name or by place (from 0). When given,
 *   the host decides the sheet and `onSheetChange` is how it hears of a choice.
 * @property {(name: string, index: number) => void} [onSheetChange] Called when a sheet tab is
 *   chosen.
 * @property {boolean} [showFormulas] Show a formula as written (`=A1+B1`) instead of the value it
 *   works out. Off by default.
 * @property {boolean} [sortable] Let a column letter be pressed to sort the rows. Defaults to
 *   true, and is off for a sheet with merged cells, as sorting would break them.
 * @property {number} [pageSize] How many rows are shown at once. Defaults to 100.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to find in the
 *   workbook: the sheet and page that hold them are shown and the words marked.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were marked
 *   (`null`: there is no target).
 * @property {(info: { sheets: string[] }) => void} [onReady] Called when the workbook is shown,
 *   with the names of its sheets.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/**
 * A viewer for an Excel workbook: a tab for each sheet and the sheet as a table, with the cell
 * styles, merged cells and column widths of the file, and rows shown a page at a time.
 *
 * @param {ExcelViewerProps} props
 */
export function ExcelViewer({
  source,
  fetcher,
  theme,
  label = 'Workbook',
  sheet,
  onSheetChange,
  showFormulas = false,
  sortable = true,
  pageSize = 100,
  target,
  onMarked,
  onReady,
  onError,
}) {
  const loaded = useSource(source, fetcher);
  const [parsed, setParsed] = useState(
    /** @type {{ blob: Blob, workbook?: import('./parseWorkbook.js').Workbook, error?: Error } | null} */ (
      null
    ),
  );
  const [picked, setPicked] = useState(/** @type {{ index: number, key: string } | null} */ (null));
  const id = useId();
  const panel = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  const marked = useLatest(onMarked);
  const changed = useLatest(onSheetChange);

  useEffect(() => {
    const { blob } = loaded;
    if (!blob) return undefined;
    let current = true;
    parseWorkbook(blob).then(
      (workbook) => current && setParsed({ blob, workbook }),
      (error) =>
        current &&
        setParsed({ blob, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      current = false;
    };
  }, [loaded]);

  const workbook = parsed?.blob === loaded.blob ? (parsed?.workbook ?? null) : null;
  const error = loaded.error ?? (parsed?.blob === loaded.blob ? (parsed?.error ?? null) : null);
  const sheets = workbook?.sheets ?? [];

  useEffect(() => {
    if (workbook) ready.current?.({ sheets: workbook.sheets.map((each) => each.name) });
  }, [workbook, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  // The sheet and row that hold the target, found again only when the words change.
  const matched = target?.matched;
  const before = target?.before;
  const after = target?.after;
  const key = `${matched}\u0000${before}\u0000${after}`;
  const located = useMemo(
    () => (workbook && matched ? locate(workbook.sheets, { matched, before, after }) : null),
    [workbook, matched, before, after],
  );

  // A sheet chosen by the reader stands until the target changes and is found in another sheet.
  let index = 0;
  if (sheet !== undefined) {
    const named =
      typeof sheet === 'string' ? sheets.findIndex((each) => each.name === sheet) : sheet;
    index = named >= 0 && named < sheets.length ? named : 0;
  } else if (picked && (picked.key === key || !located)) {
    index = Math.min(picked.index, Math.max(0, sheets.length - 1));
  } else if (located) {
    index = located.sheet;
  }
  const current = sheets.at(index);

  /** @param {number} next */
  const choose = (next) => {
    const chosen = sheets.at(next);
    if (!chosen) return;
    setPicked({ index: next, key });
    changed.current?.(chosen.name, next);
  };

  const reveal = located && located.sheet === index ? { row: located.row, key } : undefined;
  const rows = useMemo(
    () => (current ? (showFormulas ? current.formulas : current.rows) : []),
    [current, showFormulas],
  );

  // Mark the words once the sheet's page that holds them is drawn.
  useEffect(() => {
    const root = panel.current;
    if (!root || !current) return undefined;
    clearMarks(root);
    if (!matched) {
      marked.current?.(null);
      return undefined;
    }
    const mark =
      located && located.sheet === index ? markIn(root, { matched, before, after }) : null;
    marked.current?.(mark !== null);
    mark?.scrollIntoView?.({ block: 'center', inline: 'center' });
    return () => clearMarks(root);
  }, [current, located, index, matched, before, after, rows, marked]);

  /** @param {import('react').KeyboardEvent} event */
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[/** @type {'ArrowRight'} */ (event.key)];
    const jump =
      event.key === 'Home' ? -index : event.key === 'End' ? sheets.length - 1 - index : step;
    if (jump === undefined) return;
    event.preventDefault();
    const next = (index + jump + sheets.length) % sheets.length;
    choose(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  const loading = !error && !workbook;
  return (
    <div className={styles.root} style={themeVars(theme)} aria-busy={loading}>
      {loading && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The workbook could not be read: {error.message}
        </p>
      )}
      {workbook && sheets.length === 0 && (
        <p className={styles.message}>This workbook has no sheets to show.</p>
      )}
      {workbook && current && (
        <>
          <div role="tablist" aria-label={label} className={styles.tabs}>
            {sheets.map((each, place) => (
              <button
                key={`${place}-${each.name}`}
                id={`${id}-tab-${place}`}
                type="button"
                role="tab"
                aria-selected={place === index}
                aria-controls={`${id}-panel`}
                tabIndex={place === index ? 0 : -1}
                className={styles.tab}
                onClick={() => choose(place)}
                onKeyDown={onKeyDown}
              >
                {each.name}
              </button>
            ))}
          </div>
          <div
            ref={panel}
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${index}`}
            className={styles.panel}
          >
            {current.columns.length === 0 ? (
              <p className={styles.message}>This sheet is empty.</p>
            ) : (
              <Grid
                key={current.name}
                columns={current.columns}
                rows={rows}
                label={current.name}
                sortable={sortable && !current.merged}
                pageSize={pageSize}
                cellProps={(row, column) => current.cells.at(row)?.at(column)}
                columnWidths={current.widths}
                reveal={reveal}
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
        </>
      )}
    </div>
  );
}
