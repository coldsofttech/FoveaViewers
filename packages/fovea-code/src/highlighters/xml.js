// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * XML: a tokenizer and a layout, like `html.js` but for XML: no raw-text elements, names keep their
 * case and namespace prefix, and `<![CDATA[ ]]>` and `<?processing instructions?>` are known. The
 * layout keeps an element that holds only text on one line (`<title>Dune</title>`).
 */
import { collector, highlighterFor, interner } from './highlighter.js';

const intern = interner();
const state = (mode, quote) => intern(`${mode}|${quote}`, () => ({ mode, quote }));

/** The state at the start of a document. */
export const START = state('text', '');

/** Colours one line. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  let { mode, quote } = from;
  let i = 0;
  while (i < line.length) {
    if (mode === 'comment' || mode === 'cdata' || mode === 'pi') {
      const close = { comment: '-->', cdata: ']]>', pi: '?>' }[mode];
      const end = line.indexOf(close, i);
      const kind = mode === 'cdata' ? null : mode === 'pi' ? 'doctype' : 'comment';
      push(kind, end === -1 ? line.slice(i) : line.slice(i, end + close.length));
      if (end === -1) i = line.length;
      else {
        i = end + close.length;
        mode = 'text';
      }
      continue;
    }
    if (mode === 'tag') {
      const ch = line[i];
      if (quote) {
        const end = line.indexOf(quote, i);
        push('attrvalue', line.slice(i, end === -1 ? line.length : end + 1));
        if (end === -1) i = line.length;
        else {
          i = end + 1;
          quote = '';
        }
      } else if (/\s/.test(ch)) {
        let j = i + 1;
        while (j < line.length && /\s/.test(line[j])) j++;
        push(null, line.slice(i, j));
        i = j;
      } else if (ch === '>' || (ch === '/' && line[i + 1] === '>')) {
        const end = ch === '>' ? i + 1 : i + 2;
        push('tagpunct', line.slice(i, end));
        i = end;
        mode = 'text';
      } else if (ch === '=') {
        push('tagpunct', ch);
        i++;
        if (line[i] === '"' || line[i] === "'") {
          quote = line[i];
          push('attrvalue', quote);
          i++;
        }
      } else {
        let j = i;
        while (
          j < line.length &&
          !/[\s=>]/.test(line[j]) &&
          !(line[j] === '/' && line[j + 1] === '>')
        )
          j++;
        push('attribute', line.slice(i, j === i ? i + 1 : j));
        i = j === i ? i + 1 : j;
      }
      continue;
    }
    const open = line.indexOf('<', i);
    const stop = open === -1 ? line.length : open;
    let from_ = i;
    for (const entity of line.slice(i, stop).matchAll(/&(#\d+|#x[0-9a-fA-F]+|\w+);/g)) {
      const at = i + entity.index;
      push(null, line.slice(from_, at));
      push('entity', entity[0]);
      from_ = at + entity[0].length;
    }
    push(null, line.slice(from_, stop));
    i = stop;
    if (open === -1) break;
    if (line.startsWith('<!--', i)) {
      mode = 'comment';
      push('comment', '<!--');
      i += 4;
    } else if (line.startsWith('<![CDATA[', i)) {
      mode = 'cdata';
      push('doctype', '<![CDATA[');
      i += 9;
    } else if (line.startsWith('<?', i)) {
      mode = 'pi';
      push('doctype', '<?');
      i += 2;
    } else if (line[i + 1] === '!') {
      const end = line.indexOf('>', i);
      push('doctype', line.slice(i, end === -1 ? line.length : end + 1));
      i = end === -1 ? line.length : end + 1;
    } else if (/[\w:/]/.test(line[i + 1] ?? '')) {
      const closing = line[i + 1] === '/';
      const nameFrom = i + (closing ? 2 : 1);
      let j = nameFrom;
      while (j < line.length && /[^\s/>]/.test(line[j])) j++;
      push('tagpunct', line.slice(i, nameFrom));
      push('tag', line.slice(nameFrom, j));
      i = j;
      mode = 'tag';
    } else {
      push(null, '<');
      i++;
    }
  }
  return { segments, state: state(mode, quote) };
}

export const XmlHighlighter = highlighterFor(START, scan);

/**
 * Splits a document into comments, CDATA, instructions, declarations, tags and text. A character
 * that starts none of these (a lone `<`) is left out.
 *
 * This looks for each ending with `indexOf`, and remembers when one is missing, so a long run of
 * unfinished comments is read once instead of once for each `<`. (A single pattern for it
 * backtracks to the end of the document at every unfinished comment.)
 *
 * @param {string} xml
 * @returns {string[]}
 */
export function tokenize(xml) {
  /** @type {string[]} */
  const tokens = [];
  /** Endings already known not to occur after the current place. */
  const missing = new Set();
  /**
   * Where a token that must end with `ending` ends, or -1.
   *
   * @param {string} ending
   * @param {number} from
   */
  const endOf = (ending, from) => {
    if (missing.has(ending)) return -1;
    const at = xml.indexOf(ending, from);
    if (at === -1) {
      missing.add(ending);
      return -1;
    }
    return at + ending.length;
  };
  let pos = 0;
  while (pos < xml.length) {
    if (xml.charAt(pos) !== '<') {
      const next = xml.indexOf('<', pos);
      const end = next === -1 ? xml.length : next;
      tokens.push(xml.slice(pos, end));
      pos = end;
      continue;
    }
    let end = -1;
    if (xml.startsWith('<!--', pos)) end = endOf('-->', pos + 4);
    else if (xml.startsWith('<![CDATA[', pos)) end = endOf(']]>', pos + 9);
    else if (xml.startsWith('<?', pos)) end = endOf('?>', pos + 2);
    if (end === -1 && xml.startsWith('<!', pos)) end = endOf('>', pos + 2);
    if (end === -1) {
      const name = pos + (xml.charAt(pos + 1) === '/' ? 2 : 1);
      if (/[\w:]/.test(xml.charAt(name))) end = endOf('>', name + 1);
    }
    if (end === -1) {
      pos++;
    } else {
      tokens.push(xml.slice(pos, end));
      pos = end;
    }
  }
  return tokens;
}

/**
 * A document with every element on its own line, indented by depth; an element that holds only
 * text stays on one line. Comments, CDATA and instructions are kept as written.
 *
 * @param {string} xml
 * @returns {string}
 */
export function formatXml(xml) {
  const tokens = tokenize(xml);
  const out = [];
  let depth = 0;
  const put = (text) => {
    const line = text.trim();
    if (line) out.push('  '.repeat(Math.max(0, depth)) + line);
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('<')) {
      put(token.replace(/\s+/g, ' '));
    } else if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      put(token);
    } else if (/^<[\w:]/.test(token) && !token.endsWith('/>')) {
      const text = tokens[i + 1];
      const close = tokens[i + 2];
      if (text && !text.startsWith('<') && close?.startsWith('</')) {
        put(`${token}${text.replace(/\s+/g, ' ').trim()}${close}`);
        i += 2;
      } else if (token.startsWith('<?') || token.startsWith('<!')) {
        put(token);
      } else {
        put(token.replace(/\s+/g, ' '));
        depth++;
      }
    } else {
      put(
        token.startsWith('<!--')
          ? token.replace(/\s+/g, (run) => (run.includes('\n') ? ' ' : run))
          : token.replace(/\s+/g, ' '),
      );
    }
  }
  return out.join('\n');
}
