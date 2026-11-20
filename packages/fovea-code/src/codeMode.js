import { languageSpec } from './languages.js';

// A file bigger than this is not laid out (that would be a lot of text to make): its source is shown.
export const FORMAT_LIMIT = 20 * 1024 * 1024;
// A line longer than this is not drawn in full (nor coloured): a minified file is one such line.
export const LONG_LINE = 20000;
// A file with a line this long is shown laid out (when its language can be) until told otherwise.
export const MINIFIED = 2000;

/**
 * How a file is shown: `source` as it is, or `formatted` (laid out, for a minified file). The
 * choice is the person's (`null` until they make one); without it a file with a very long line
 * opens laid out, when its language has a layout.
 *
 * @param {string} language A key of `LANGUAGES`.
 * @param {string | null} text The file's text (null while it is being read).
 * @param {number} longestLine The length of its longest line.
 * @param {'source' | 'formatted' | null} choice
 * @returns {{ mode: 'source' | 'formatted', canFormat: boolean, tooBig: boolean }}
 */
export function codeMode(language, text, longestLine, choice) {
  const tooBig = text !== null && text.length > FORMAT_LIMIT;
  const canFormat = Boolean(languageSpec(language)?.format) && !tooBig;
  const mode = !canFormat
    ? 'source'
    : (choice ?? (longestLine > MINIFIED ? 'formatted' : 'source'));
  return { mode, canFormat, tooBig };
}
