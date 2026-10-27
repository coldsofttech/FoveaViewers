/**
 * @typedef {object} Table
 * @property {string[][]} rows Every row, as an array of cells.
 * @property {string} delimiter The character that separates cells.
 */

const CANDIDATES = [',', '\t', ';', '|'];

/**
 * Picks the delimiter that appears most in the first line, ignoring text in quotes.
 *
 * @param {string} text
 * @returns {string}
 */
function detectDelimiter(text) {
  const counts = new Map(CANDIDATES.map((c) => [c, 0]));
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let best = ',';
  for (const [char, count] of counts) if (count > (counts.get(best) ?? 0)) best = char;
  return best;
}

/**
 * Reads delimited text (RFC 4180): quoted cells may hold the delimiter, line breaks and `""` for a
 * quote. A byte order mark is dropped, and so is a blank line at the end.
 *
 * @param {string} text
 * @param {{ delimiter?: string }} [options] The delimiter is found from the first line if not given.
 * @returns {Table}
 */
export function parseTable(text, { delimiter } = {}) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const separator = delimiter || detectDelimiter(source);
  /** @type {string[][]} */
  const rows = [];
  let row = /** @type {string[]} */ ([]);
  let cell = '';
  let quoted = false;
  let started = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < source.length; i++) {
    const char = source.charAt(i);
    if (quoted) {
      if (char !== '"') cell += char;
      else if (source.charAt(i + 1) === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (char === '"' && cell === '') {
      quoted = true;
      started = true;
    } else if (char === separator) {
      endCell();
      started = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source.charAt(i + 1) === '\n') i++;
      endRow();
    } else {
      cell += char;
      started = true;
    }
  }
  if (started || cell !== '' || row.length > 0) endRow();

  return { rows, delimiter: separator };
}
