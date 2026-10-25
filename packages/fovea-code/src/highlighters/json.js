// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * JSON: a tokenizer (a line is coloured on its own: a string cannot run over a line) and a layout
 * for minified files that works on the tokens, so it keeps duplicate keys, key order and numbers
 * exactly as written (parsing and printing would not).
 */
import { collector, highlighterFor } from './highlighter.js';

const CONSTANT = /^(true|false|null)\b/;
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

const readString = (line, i) => {
  let j = i + 1;
  while (j < line.length && line[j] !== '"') j += line[j] === '\\' ? 2 : 1;
  return Math.min(line.length, j + 1);
};

/** Colours one line. State-free: `from` and the returned `state` are always `null`. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      push(null, line.slice(i, j));
      i = j;
    } else if (ch === '"') {
      const end = readString(line, i);
      let k = end;
      while (k < line.length && /\s/.test(line[k])) k++;
      push(line[k] === ':' ? 'key' : 'string', line.slice(i, end));
      i = end;
    } else if (/[{}[\],:]/.test(ch)) {
      push('punct', ch);
      i++;
    } else {
      const rest = line.slice(i, i + 40);
      const found = NUMBER.exec(rest) ?? CONSTANT.exec(rest);
      if (found) {
        push(CONSTANT.test(rest) && !NUMBER.test(rest) ? 'constant' : 'number', found[0]);
        i += found[0].length;
      } else {
        push(null, ch);
        i++;
      }
    }
  }
  return { segments, state: null };
}

export const JsonHighlighter = highlighterFor(null, scan);

/**
 * JSON with every value on its own line, indented two spaces by depth (`{}` and `[]` stay as they
 * are). Works on the tokens, not a parse, so it also lays out a file that is not valid.
 *
 * @param {string} text
 * @returns {string}
 */
export function formatJson(text) {
  const out = [];
  let line = '';
  let depth = 0;
  const flush = () => {
    if (line.trim()) out.push('  '.repeat(Math.max(0, depth)) + line.trim());
    line = '';
  };
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === '"') {
      const end = readString(text, i);
      line += text.slice(i, end);
      i = end;
    } else if (ch === '{' || ch === '[') {
      const close = ch === '{' ? '}' : ']';
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === close) {
        line += ch + close;
        i = j + 1;
      } else {
        line += ch;
        flush();
        depth++;
        i++;
      }
    } else if (ch === '}' || ch === ']') {
      flush();
      depth = Math.max(0, depth - 1);
      line += ch;
      i++;
    } else if (ch === ',') {
      line += ',';
      flush();
      i++;
    } else if (ch === ':') {
      line += ': ';
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      line += ch;
      i++;
    }
  }
  flush();
  return out.join('\n');
}
