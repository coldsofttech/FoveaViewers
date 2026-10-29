/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
import { scoreMatch, squash } from '@coldsofttech/fovea-viewers/core';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').GridCell} GridCell
 */

/**
 * @typedef {object} Sheet
 * @property {string} name
 * @property {string[]} columns The column letters: A, B, C...
 * @property {string[][]} rows What each cell shows.
 * @property {string[][]} formulas The same, with a formula shown as `=formula`.
 * @property {(GridCell | undefined)[][]} cells Styles and spans, by row and column.
 * @property {(string | undefined)[]} widths A CSS width for each column.
 * @property {boolean} merged Whether the sheet has merged cells.
 */

/**
 * @typedef {object} Workbook
 * @property {Sheet[]} sheets The sheets that are not hidden.
 */

// A sheet can claim far more rows and columns than it uses; this keeps one from freezing the page.
const MAX_ROWS = 100000;
const MAX_COLUMNS = 500;

/** @type {Promise<any> | null} */
let loading = null;

/**
 * Loads ExcelJS the first time a workbook is opened, so a page that never shows one never pays
 * for it.
 *
 * @returns {Promise<any>}
 */
function loadExcel() {
  loading ??= import('exceljs').then((module) => module.default ?? module);
  return loading;
}

/**
 * The letters of a column: 1 is A, 27 is AA.
 *
 * @param {number} number
 * @returns {string}
 */
export function columnName(number) {
  let name = '';
  for (let n = number; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/**
 * The number of a column from its letters: A is 1, AA is 27.
 *
 * @param {string} letters
 * @returns {number}
 */
function columnNumber(letters) {
  let number = 0;
  for (const letter of letters) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
}

/**
 * A cell range such as `B2:D4` as zero-based rows and columns, or `null` when it is not one.
 *
 * @param {string} range
 * @returns {{ top: number, left: number, bottom: number, right: number } | null}
 */
function parseRange(range) {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range.toUpperCase());
  if (!match) return null;
  return {
    top: Number(match[2]) - 1,
    left: columnNumber(/** @type {string} */ (match[1])) - 1,
    bottom: Number(match[4]) - 1,
    right: columnNumber(/** @type {string} */ (match[3])) - 1,
  };
}

/** @param {number} value @param {number} places */
const pad = (value, places = 2) => String(value).padStart(places, '0');

/**
 * A date as `2024-10-01`, with the time when it is not midnight.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  if (Number.isNaN(date.getTime())) return '';
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return time === '00:00:00' ? day : `${day} ${time}`;
}

/**
 * A number the way its Excel format shows it, for the common formats: decimals, thousands
 * separators, percentages and a currency sign or other text around it.
 *
 * @param {number} value
 * @param {string | undefined} format
 * @returns {string}
 */
export function formatNumber(value, format) {
  if (!format || format === 'General') return String(value);
  const section = (format.split(';')[0] ?? '')
    .replace(/\[\$([^\-\]]*)[^\]]*\]/g, '$1') // [$€-407] is a euro sign
    .replace(/\[[^\]]*\]/g, '') // other brackets are colours and conditions
    .replace(/_.|\*./g, '') // padding and fill characters
    .replace(/"([^"]*)"/g, '$1')
    .replace(/\\(.)/g, '$1');
  const digits = /[0#?][0#?,.]*/.exec(section);
  if (!digits) return String(value);
  const percent = section.includes('%');
  const decimals = digits[0].includes('.')
    ? (digits[0].split('.')[1] ?? '').replace(/,/g, '').length
    : 0;
  const shown = (percent ? value * 100 : value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: digits[0].includes(','),
  });
  const before = section.slice(0, digits.index).replace('%', '');
  const after = section.slice(digits.index + digits[0].length);
  return `${before}${shown}${after}`.trim();
}

/**
 * What a cell value reads as: its text, with a formula showing the value it worked out.
 *
 * @param {any} value
 * @param {string | undefined} format
 * @returns {string}
 */
function textOf(value, format) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'number') return formatNumber(value, format);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  if (Array.isArray(value.richText)) {
    return value.richText.map((/** @type {{ text: string }} */ part) => part.text).join('');
  }
  if ('formula' in value || 'sharedFormula' in value) return textOf(value.result, format);
  if ('error' in value) return String(value.error);
  if ('text' in value) return textOf(value.text, format);
  return '';
}

/** @param {any} color @returns {string | undefined} */
const colourOf = (color) => (color?.argb ? `#${String(color.argb).slice(-6)}` : undefined);

const WEIGHT = new Map([
  ['medium', 2],
  ['thick', 3],
  ['double', 3],
]);

/**
 * @param {any} side
 * @returns {string | undefined}
 */
function borderOf(side) {
  if (!side?.style) return undefined;
  const line = side.style === 'dotted' || side.style === 'hair' ? 'dotted' : 'solid';
  const kind = side.style === 'dashed' ? 'dashed' : side.style === 'double' ? 'double' : line;
  return `${WEIGHT.get(side.style) ?? 1}px ${kind} ${colourOf(side.color) ?? '#000'}`;
}

/**
 * A cell's look as CSS: bold, italic, underline, colours, fill, alignment and borders.
 *
 * @param {any} cell
 * @param {any} value
 * @returns {import('react').CSSProperties | undefined}
 */
function styleOf(cell, value) {
  /** @type {import('react').CSSProperties} */
  const css = {};
  const font = cell.font;
  if (font) {
    if (font.bold) css.fontWeight = 700;
    if (font.italic) css.fontStyle = 'italic';
    const lines = [font.underline && 'underline', font.strike && 'line-through'].filter(Boolean);
    if (lines.length) css.textDecoration = lines.join(' ');
    if (font.size && font.size !== 11) css.fontSize = `${font.size}pt`;
    const color = colourOf(font.color);
    if (color) css.color = color;
  }
  const fill = cell.fill;
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const background = colourOf(fill.fgColor);
    if (background) css.backgroundColor = background;
  }
  const alignment = cell.alignment;
  const horizontal = alignment?.horizontal;
  if (horizontal === 'left' || horizontal === 'right' || horizontal === 'justify') {
    css.textAlign = horizontal;
  } else if (horizontal === 'center' || horizontal === 'centerContinuous') {
    css.textAlign = 'center';
  } else if (typeof value === 'number' || value instanceof Date) {
    css.textAlign = 'right';
  }
  if (alignment?.vertical === 'top') css.verticalAlign = 'top';
  else if (alignment?.vertical === 'middle') css.verticalAlign = 'middle';
  if (alignment?.wrapText) css.whiteSpace = 'pre-wrap';
  const border = cell.border;
  if (border) {
    const top = borderOf(border.top);
    const right = borderOf(border.right);
    const bottom = borderOf(border.bottom);
    const left = borderOf(border.left);
    if (top) css.borderTop = top;
    if (right) css.borderRight = right;
    if (bottom) css.borderBottom = bottom;
    if (left) css.borderLeft = left;
  }
  return Object.keys(css).length ? css : undefined;
}

/**
 * @param {any} worksheet
 * @returns {Sheet}
 */
function readSheet(worksheet) {
  const rowCount = Math.min(worksheet.rowCount ?? 0, MAX_ROWS);
  const columnCount = Math.min(worksheet.columnCount ?? 0, MAX_COLUMNS);

  /** @type {string[][]} */
  const rows = [];
  /** @type {string[][]} */
  const formulas = [];
  /** @type {(GridCell | undefined)[][]} */
  const cells = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.findRow(r);
    const texts = [];
    const withFormulas = [];
    const extras = [];
    for (let c = 1; c <= columnCount; c++) {
      const cell = row?.findCell(c);
      // A merged cell reads as the top left one, so only that one has a value.
      const covered = cell?.isMerged && cell.master !== cell;
      const value = cell && !covered ? cell.value : null;
      const text = cell ? textOf(value, cell.numFmt) : '';
      texts.push(text);
      withFormulas.push(cell && !covered && cell.formula ? `=${cell.formula}` : text);
      extras.push(cell && value !== null ? { style: styleOf(cell, value) } : undefined);
    }
    rows.push(texts);
    formulas.push(withFormulas);
    cells.push(extras);
  }

  // A merged cell is drawn once, by its top left cell; the others it covers are left out.
  let merged = false;
  for (const text of worksheet.model?.merges ?? []) {
    const range = parseRange(text);
    if (!range) continue;
    const bottom = Math.min(range.bottom, rowCount - 1);
    const right = Math.min(range.right, columnCount - 1);
    if (range.top > bottom || range.left > right) continue;
    merged = true;
    for (let r = range.top; r <= bottom; r++) {
      for (let c = range.left; c <= right; c++) {
        if (r === range.top && c === range.left) {
          cells[r][c] = {
            ...cells[r][c],
            colSpan: right - range.left + 1,
            rowSpan: bottom - range.top + 1,
          };
        } else {
          cells[r][c] = { coveredBy: range.top };
        }
      }
    }
  }

  const widths = Array.from({ length: columnCount }, (_, i) => {
    const width = worksheet.columns?.[i]?.width;
    return typeof width === 'number' && width > 0 ? `${Math.round(width + 1)}ch` : undefined;
  });

  return {
    name: worksheet.name,
    columns: Array.from({ length: columnCount }, (_, i) => columnName(i + 1)),
    rows,
    formulas,
    cells,
    widths,
    merged,
  };
}

/**
 * Reads an `.xlsx` or `.xlsm` workbook. Macros are never run.
 *
 * @param {Blob | ArrayBuffer} source
 * @returns {Promise<Workbook>}
 */
export async function parseWorkbook(source) {
  const ExcelJS = await loadExcel();
  const buffer = source instanceof Blob ? await source.arrayBuffer() : source;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = workbook.worksheets
    .filter((/** @type {{ state?: string }} */ sheet) => !sheet.state || sheet.state === 'visible')
    .map(readSheet);
  return { sheets };
}

/**
 * Finds the sheet and row that hold some words, as the other viewers do: the place where the words
 * and the text around them agree best.
 *
 * @param {Sheet[]} sheets
 * @param {{ matched: string, before?: string, after?: string } | undefined} target
 * @returns {{ sheet: number, row: number } | null}
 */
export function locate(sheets, target) {
  const needle = squash(target?.matched);
  if (!needle) return null;
  const before = squash(target?.before);
  const after = squash(target?.after);
  /** @type {{ sheet: number, row: number } | null} */
  let best = null;
  let bestScore = -1;
  sheets.forEach((sheet, index) => {
    const texts = sheet.rows.map((row) => squash(row.join(' ')));
    const { at, score } = scoreMatch(texts.join(''), needle, before, after);
    if (at === -1 || score <= bestScore) return;
    let row = 0;
    for (let end = texts[0]?.length ?? 0; end <= at && row < texts.length - 1;) {
      row++;
      end += texts[row]?.length ?? 0;
    }
    best = { sheet: index, row };
    bestScore = score;
  });
  return best;
}
