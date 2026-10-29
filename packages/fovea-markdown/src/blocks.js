/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
import markdownit from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

// Only these can be followed or loaded. Anything else (javascript:, data:, file:...) is shown as
// plain text, so a file cannot make the viewer run or open something unexpected.
const SAFE_LINK = /^(https?:|mailto:|#)/i;
const SAFE_IMAGE = /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);base64,)/i;

/**
 * Markdown to HTML a block at a time. Raw HTML in the text is shown as text, never as markup.
 * Links with an unsafe address lose their address, and pictures are shown as their alt text
 * unless `allowImages` is set.
 *
 * @param {{ allowImages?: boolean }} [options]
 */
export function createMarkdown({ allowImages = false } = {}) {
  const md = markdownit({ html: false, linkify: false, typographer: false, breaks: false });
  md.use(footnote);
  md.use(taskLists, { label: true });

  md.renderer.rules.link_open = (tokens, index) => {
    const token = tokens[index];
    const href = String(token.attrGet('href') ?? '').trim();
    if (!SAFE_LINK.test(href)) return '<a>';
    const title = String(token.attrGet('title') ?? '');
    const titleAttr = title ? ` title="${md.utils.escapeHtml(title)}"` : '';
    return `<a href="${md.utils.escapeHtml(href)}"${titleAttr}>`;
  };
  md.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    const src = String(token.attrGet('src') ?? '').trim();
    const alt = md.utils.escapeHtml(token.content || 'image');
    if (allowImages && SAFE_IMAGE.test(src)) {
      return `<img src="${md.utils.escapeHtml(src)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`;
    }
    return `<span data-image>[${alt}]</span>`;
  };
  return md;
}

/**
 * @typedef {ReturnType<typeof createMarkdown>} Markdown
 * @typedef {{ start: number, end: number, tokens: import('markdown-it').Token[] }} Block
 */

/**
 * The top-level blocks of a text (a heading, a paragraph, a whole list, a code block, a table...),
 * each with the lines it covers: `start` (0-based) up to `end` (not included).
 *
 * @param {Markdown} md
 * @param {string} text
 * @returns {Block[]}
 */
export function blocksOf(md, text) {
  const tokens = md.parse(text, {});
  /** @type {Block[]} */
  const blocks = [];
  let footnotesAt = [0, 0];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // The footnotes block has no source lines of its own: it is placed where the text ends.
    const map = token.map ?? (token.type === 'footnote_block_open' ? footnotesAt : null);
    if (token.level !== 0 || !map) continue;
    let last = i;
    if (token.nesting === 1) {
      while (last < tokens.length && !(tokens[last].level === 0 && tokens[last].nesting === -1)) {
        last++;
      }
    }
    blocks.push({ start: map[0], end: map[1], tokens: tokens.slice(i, last + 1) });
    footnotesAt = [map[1], map[1]];
    i = last;
  }
  return blocks;
}

/**
 * The index of the block that holds source line `line` (0-based), or the one just before it.
 *
 * @param {Block[]} blocks
 * @param {number} line
 * @returns {number}
 */
export function blockAt(blocks, line) {
  let low = 0;
  let high = blocks.length - 1;
  let found = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (blocks[middle].start <= line) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}

/**
 * A block as HTML.
 *
 * @param {Markdown} md
 * @param {Block} block
 * @returns {string}
 */
export const render = (md, block) => md.renderer.render(block.tokens, md.options, {});

/**
 * Which block holds each footnote link (`fnref1`) and each footnote (`fn1`), so a click on one can
 * draw the block that holds the other even when it is far off screen.
 *
 * @param {Block[]} blocks
 * @returns {Map<string, number>} Element id to block index.
 */
export function anchorsOf(blocks) {
  /** @type {Map<string, number>} */
  const anchors = new Map();
  blocks.forEach((block, index) => {
    for (const token of block.tokens) {
      if (token.type === 'footnote_open') {
        anchors.set(`fn${/** @type {{ id: number }} */ (token.meta).id + 1}`, index);
      }
      for (const child of token.children ?? []) {
        if (child.type !== 'footnote_ref') continue;
        const meta = /** @type {{ id: number, subId: number }} */ (child.meta);
        const sub = meta.subId > 0 ? `:${meta.subId}` : '';
        anchors.set(`fnref${meta.id + 1}${sub}`, index);
      }
    }
  });
  return anchors;
}
