/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
import { bestMatch, isIgnored, squash } from './match.js';

/**
 * Finds words in the source of a Markdown file. A search runs on the words without the markup, so
 * both sides are compared with the markup characters and every space taken out, in lower case;
 * when the words occur more than once, the occurrence whose surroundings look most like the
 * match's own wins.
 *
 * @param {string} text The Markdown source.
 * @param {{ before?: string, matched: string, after?: string }} match
 * @returns {{ offset: number, end: number, line: number, column: number } | null} Where the words
 *   are in the source: character offsets, and the line and column (both from 1).
 */
export function locateInSource(text, match) {
  const needle = squash(match.matched);
  if (!needle) return null;
  // The squashed text, and for each of its characters where it came from.
  const kept = new Int32Array(text.length);
  let hay = '';
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i).toLowerCase();
    if (isIgnored(ch) || ch.length !== 1) continue;
    kept[count++] = i;
    hay += ch;
  }
  const best = bestMatch(hay, needle, squash(match.before), squash(match.after));
  if (best === -1) return null;
  const offset = kept[best];
  const end = kept[best + needle.length - 1] + 1;
  const upTo = text.slice(0, offset);
  const lineStart = upTo.lastIndexOf('\n') + 1;
  return {
    offset,
    end,
    line: upTo.split('\n').length,
    column: offset - lineStart + 1,
  };
}
