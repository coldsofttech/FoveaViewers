import {
  applyTheme,
  clearMarks,
  createGrid,
  createShell,
  loadSource,
  markIn,
} from '@coldsofttech/fovea-viewers/core/vanilla';
import { locate, parseWorkbook } from '../parseWorkbook.js';
import styles from '../ExcelViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../parseWorkbook.js').Workbook} Workbook
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

let counter = 0;

/**
 * A viewer for an Excel workbook, drawn into a container: a tab for each sheet and the sheet as a
 * table, with the cell styles, merged cells and column widths of the file, and rows shown a page at
 * a time.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {ExcelViewerProps} props
 * @returns {ViewerController}
 */
export function createExcelViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;
  const id = `fovea-excel-${++counter}`;

  /** @type {Workbook | null} */
  let workbook = null;
  /** @type {Error | null} */
  let error = null;
  /** @type {{ index: number, key: string } | null} */
  let picked = null;
  /** @type {HTMLElement[]} */
  let messages = [];
  /** @type {{ workbook: Workbook, list: HTMLElement, tabs: HTMLElement[] } | null} */
  let tabBar = null;
  /** @type {HTMLElement | null} */
  let panel = null;
  /** @type {{ name: string, controller: ViewerController } | null} */
  let grid = null;
  /** @type {HTMLElement | null} */
  let emptySheet = null;
  /** @type {{ workbook: Workbook | null, key: string, found: ReturnType<typeof locate> } | null} */
  let locatedCache = null;
  /** @type {Workbook | null} */
  let reportedWorkbook = null;
  /** @type {Error | null} */
  let failed = null;
  /** @type {string} */
  let markedFor = '';

  const targetKey = () => {
    const { target } = shell.props;
    return `${target?.matched}\u0000${target?.before}\u0000${target?.after}`;
  };

  /** The sheet and row that hold the target, found again only when the words change. */
  function located() {
    const { target } = shell.props;
    const key = targetKey();
    if (!(locatedCache && locatedCache.workbook === workbook && locatedCache.key === key)) {
      locatedCache = {
        workbook,
        key,
        found:
          workbook && target?.matched
            ? locate(workbook.sheets, {
                matched: target.matched,
                before: target.before,
                after: target.after,
              })
            : null,
      };
    }
    return locatedCache.found;
  }

  /** The place of the sheet shown: the host's choice, the reader's, or where the target is. */
  function sheetIndex() {
    const sheets = workbook?.sheets ?? [];
    const found = located();
    const { sheet } = shell.props;
    if (sheet !== undefined) {
      const named =
        typeof sheet === 'string' ? sheets.findIndex((each) => each.name === sheet) : sheet;
      return named >= 0 && named < sheets.length ? named : 0;
    }
    // A sheet chosen by the reader stands until the target changes and is found in another sheet.
    if (picked && (picked.key === targetKey() || !found)) {
      return Math.min(picked.index, Math.max(0, sheets.length - 1));
    }
    return found ? found.sheet : 0;
  }

  /** @param {number} next */
  function choose(next) {
    const chosen = workbook?.sheets.at(next);
    if (!chosen) return;
    picked = { index: next, key: targetKey() };
    render();
    shell.emit('onSheetChange', chosen.name, next);
  }

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    const sheets = workbook?.sheets ?? [];
    const step = /** @type {Record<string, number>} */ ({ ArrowRight: 1, ArrowLeft: -1 })[
      event.key
    ];
    const index = sheetIndex();
    const jump =
      event.key === 'Home' ? -index : event.key === 'End' ? sheets.length - 1 - index : step;
    if (jump === undefined) return;
    event.preventDefault();
    const next = (index + jump + sheets.length) % sheets.length;
    choose(next);
    tabBar?.tabs.at(next)?.focus();
  }

  function buildTabs(/** @type {Workbook} */ book) {
    const tabs = book.sheets.map((each, place) =>
      h(
        'button',
        {
          id: `${id}-tab-${place}`,
          type: 'button',
          role: 'tab',
          'aria-controls': `${id}-panel`,
          class: styles.tab,
          onclick: () => choose(place),
          onkeydown: onKeyDown,
        },
        each.name,
      ),
    );
    const list = h('div', { role: 'tablist', class: styles.tabs }, tabs);
    return { workbook: book, list, tabs };
  }

  function dropSheet() {
    grid?.controller.destroy();
    grid = null;
    emptySheet?.remove();
    emptySheet = null;
  }

  function render() {
    const loading = !error && !workbook;
    root.setAttribute('aria-busy', String(loading));
    for (const message of messages) message.remove();
    messages = [];
    if (loading) messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (error) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The workbook could not be read: ${error.message}`,
        ),
      );
    }
    const sheets = workbook?.sheets ?? [];
    if (workbook && sheets.length === 0) {
      messages.push(h('p', { class: styles.message }, 'This workbook has no sheets to show.'));
    }
    root.prepend(...messages);

    const index = sheetIndex();
    const current = sheets.at(index);
    if (!workbook || !current) {
      tabBar?.list.remove();
      tabBar = null;
      panel?.remove();
      panel = null;
      dropSheet();
    } else {
      const {
        label = 'Workbook',
        showFormulas = false,
        sortable = true,
        pageSize = 100,
      } = shell.props;
      if (!tabBar || tabBar.workbook !== workbook) {
        tabBar?.list.remove();
        tabBar = buildTabs(workbook);
        root.append(tabBar.list);
      }
      tabBar.list.setAttribute('aria-label', label);
      tabBar.tabs.forEach((tab, place) => {
        tab.setAttribute('aria-selected', String(place === index));
        tab.setAttribute('tabindex', place === index ? '0' : '-1');
      });
      if (!panel) {
        panel = h('div', { role: 'tabpanel', class: styles.panel });
        root.append(panel);
      }
      panel.id = `${id}-panel`;
      panel.setAttribute('aria-labelledby', `${id}-tab-${index}`);

      if (current.columns.length === 0) {
        grid?.controller.destroy();
        grid = null;
        if (!emptySheet) {
          emptySheet = h('p', { class: styles.message }, 'This sheet is empty.');
          panel.append(emptySheet);
        }
      } else {
        emptySheet?.remove();
        emptySheet = null;
        const found = located();
        const gridProps = {
          columns: current.columns,
          rows: showFormulas ? current.formulas : current.rows,
          label: current.name,
          sortable: sortable && !current.merged,
          pageSize,
          cellProps: (/** @type {number} */ row, /** @type {number} */ column) =>
            current.cells.at(row)?.at(column),
          columnWidths: current.widths,
          reveal: found && found.sheet === index ? { row: found.row, key: targetKey() } : undefined,
          classNames: {
            root: styles.grid,
            scroll: styles.scroll,
            table: styles.table,
            headerCell: styles.headerCell,
            sortButton: styles.sortButton,
            cell: styles.cell,
            pager: styles.pager,
          },
        };
        // A new sheet is a new grid, so it starts on its first page, unsorted.
        if (grid && grid.name !== current.name) {
          grid.controller.destroy();
          grid = null;
        }
        if (grid) grid.controller.update(gridProps);
        else grid = { name: current.name, controller: createGrid(panel, gridProps) };
      }
    }

    markWords(index, current);

    if (workbook && workbook !== reportedWorkbook) {
      shell.emit('onReady', { sheets: workbook.sheets.map((each) => each.name) });
    }
    reportedWorkbook = workbook;
    if (error && error !== failed) shell.emit('onError', error);
    failed = error;
  }

  /** Marks the words once the sheet's page that holds them is drawn. */
  function markWords(
    /** @type {number} */ index,
    /** @type {import('../parseWorkbook.js').Sheet | undefined} */ current,
  ) {
    if (!panel || !current) return;
    const { target, showFormulas } = shell.props;
    const found = located();
    const signature = `${workbook === null ? 0 : sheetsId(workbook)}:${current.name}:${index}:${targetKey()}:${Boolean(showFormulas)}:${found?.sheet}:${found?.row}`;
    if (signature === markedFor) return;
    markedFor = signature;
    clearMarks(panel);
    if (!target?.matched) {
      shell.emit('onMarked', null);
      return;
    }
    const mark =
      found && found.sheet === index
        ? markIn(panel, { matched: target.matched, before: target.before, after: target.after })
        : null;
    shell.emit('onMarked', mark !== null);
    mark?.scrollIntoView?.({ block: 'center', inline: 'center' });
  }

  /** @type {WeakMap<Workbook, number>} */
  const ids = new WeakMap();
  let issued = 0;
  /** A number for each workbook, so a signature can tell one from another. */
  function sheetsId(/** @type {Workbook} */ book) {
    if (!ids.has(book)) ids.set(book, ++issued);
    return ids.get(book);
  }

  function reload() {
    workbook = null;
    error = null;
    picked = null;
    markedFor = '';
    render();
    shell.load(
      async (signal) => {
        const blob = await loadSource(shell.props.source, { fetcher: shell.props.fetcher, signal });
        return parseWorkbook(blob);
      },
      {
        onResult(loaded) {
          workbook = loaded;
          render();
        },
        onError(failure) {
          error = failure;
          render();
        },
      },
    );
  }

  shell.cleanup(dropSheet);
  applyTheme(root, props.theme);
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else render();
  });
  return shell.api;
}
