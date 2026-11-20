/**
 * Splits text into lines on `\n`, `\r\n` or `\r`. A final line break does not add an empty line.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
