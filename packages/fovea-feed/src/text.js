import { sanitizeToFragment } from './sanitize.js';

/** Elements that start a new line of text. */
const BLOCKS = 'p,div,li,ul,ol,h1,h2,h3,h4,h5,h6,tr,blockquote,pre,section,article,table,hr';

/**
 * The text of a piece of HTML, with paragraphs and line breaks kept as line breaks and everything
 * else (tags, scripts, styles) left out. The HTML is only parsed, never run or loaded.
 *
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  // The markup is cleaned first (scripts, styles and the like are dropped with their content), and
  // only then read, so text from the feed is never parsed as it came.
  const doc = sanitizeToFragment(html, false);
  for (const br of doc.querySelectorAll('br')) br.replaceWith('\n');
  for (const block of doc.querySelectorAll(BLOCKS)) block.append('\n');
  return tidy(doc.textContent ?? '');
}

/**
 * Text with each run of spaces made one space, no more than one blank line in a row, and no spaces
 * or blank lines at the ends.
 *
 * @param {string} text
 * @returns {string}
 */
export function tidy(text) {
  return text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Whether text looks like HTML: it has a tag or a named entity.
 *
 * @param {string} text
 * @returns {boolean}
 */
export const looksLikeHtml = (text) => /<\/?[a-z][^>]*>|&[a-z]+;|&#\d+;/i.test(text);
