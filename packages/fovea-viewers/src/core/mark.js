/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
import { bestMatch, isIgnored, squash } from './match.js';

const HIT = 'data-fovea-hit';

/**
 * Takes the marks made by `markIn` out again.
 *
 * @param {HTMLElement} root
 */
export function clearMarks(root) {
  for (const mark of root.querySelectorAll(`mark[${HIT}]`)) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes);
    parent?.normalize();
  }
}

/**
 * Marks `matched` in the text an element shows, ignoring spaces, case and the formatting that
 * splits the words across elements. With the words more than once, the one after `before` and
 * before `after` wins.
 *
 * @param {HTMLElement} root
 * @param {{ before?: string, matched: string, after?: string }} match
 * @param {{ skip?: string, style?: string }} [options] `skip`: a selector for elements whose
 *   text is not looked in (scripts, styles...). `style`: inline CSS for the marks, for a document
 *   that has none of the page's own styles, such as the inside of a frame.
 * @returns {HTMLElement | null} The first mark, or null when the words are not in what is shown.
 */
export function markIn(root, match, options = {}) {
  const doc = root.ownerDocument;
  const { skip, style } = options;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
    acceptNode: (node) =>
      skip && node.parentElement?.closest(skip) ? 2 /* FILTER_REJECT */ : 1 /* FILTER_ACCEPT */,
  });
  /** @type {Text[]} */
  const nodes = [];
  let hay = '';
  /** @type {Array<[number, number]>} For each squashed character: node index, offset in it. */
  const owner = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    nodes.push(/** @type {Text} */ (node));
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i).toLowerCase();
      if (isIgnored(ch) || ch.length !== 1) continue;
      hay += ch;
      owner.push([nodes.length - 1, i]);
    }
  }
  const needle = squash(match.matched);
  if (!needle) return null;
  const best = bestMatch(hay, needle, squash(match.before), squash(match.after));
  if (best === -1) return null;

  // The text of each node the words touch, from where they start to where they end.
  const first = owner[best];
  const last = owner[best + needle.length - 1];
  /** @type {Array<[Text, number, number]>} */
  const spans = [];
  for (let n = first[0]; n <= last[0]; n++) {
    const from = n === first[0] ? first[1] : 0;
    const to = n === last[0] ? last[1] + 1 : (nodes[n].nodeValue ?? '').length;
    spans.push([nodes[n], from, to]);
  }
  /** @type {HTMLElement | null} */
  let firstMark = null;
  // From the end, so earlier offsets stay valid as nodes are split.
  for (const [node, from, to] of spans.reverse()) {
    const range = doc.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const mark = doc.createElement('mark');
    mark.setAttribute(HIT, '');
    if (style) mark.style.cssText = style;
    range.surroundContents(mark);
    firstMark = mark;
  }
  return firstMark;
}
