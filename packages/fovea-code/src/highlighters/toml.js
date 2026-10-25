// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * TOML: a line tokenizer. The state carried from line to line is only whether a multi-line string
 * (`"""` or `'''`) is open, and which, so any window of lines can be coloured.
 */
import { collector, highlighterFor, interner } from './highlighter.js';

const intern = interner();
const state = (open) => intern(`${open}`, () => ({ open }));

/** The state at the start of a document (no multi-line string open). */
export const START = state('');

const KEY_PART = String.raw`(?:[A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*"|'[^']*')`;
// eslint-disable-next-line security/detect-non-literal-regexp -- built from the fixed pattern above
const KEY = new RegExp(String.raw`^${KEY_PART}(?:\s*\.\s*${KEY_PART})*(?=\s*=)`);
const NUMBER =
  /^[-+]?(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d[\d_]*)?)$/;
const DATE =
  /^\d{4}-\d\d-\d\d(?:[Tt ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:[Zz]|[-+]\d\d:\d\d)?)?$|^\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/;
const CONSTANT = /^(?:true|false|[-+]?inf|[-+]?nan)$/;

/**
 * Colours a value (the rest of a line after `key =`, or a line inside a multi-line array), and says
 * which multi-line string it leaves open, if any.
 */
function value(rest, push) {
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < rest.length && /\s/.test(rest[j])) j++;
      push(null, rest.slice(i, j));
      i = j;
    } else if (ch === '#') {
      push('comment', rest.slice(i));
      return START;
    } else if (rest.startsWith('"""', i) || rest.startsWith("'''", i)) {
      const delim = rest.slice(i, i + 3);
      const end = closing(rest, i + 3, delim);
      if (end < 0) {
        push('string', rest.slice(i));
        return state(delim);
      }
      push('string', rest.slice(i, end));
      i = end;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < rest.length && rest[j] !== ch) j += ch === '"' && rest[j] === '\\' ? 2 : 1;
      push('string', rest.slice(i, Math.min(rest.length, j + 1)));
      i = Math.min(rest.length, j + 1);
    } else if (/[[\]{},=]/.test(ch)) {
      push('punct', ch);
      i++;
    } else {
      let j = i;
      while (j < rest.length && !/[\s,[\]{}=#]/.test(rest[j])) j++;
      if (j === i) j = i + 1;
      const word = rest.slice(i, j);
      const next = /^\s*=/.test(rest.slice(j));
      const kind = next
        ? 'key'
        : CONSTANT.test(word)
          ? 'constant'
          : NUMBER.test(word) || DATE.test(word)
            ? 'number'
            : null;
      push(kind, word);
      i = j;
    }
  }
  return START;
}

/** Where a multi-line string that began before `from` ends (just after its closing quotes), or -1. */
function closing(text, from, delim) {
  for (let i = from; i < text.length; i++) {
    if (delim === '"""' && text[i] === '\\') {
      i++;
    } else if (text.startsWith(delim, i)) {
      let end = i + 3;
      while (text[end] === delim[0] && end < i + 5) end++; // up to two quotes may touch the end
      return end;
    }
  }
  return -1;
}

/** Colours one line. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  if (from.open) {
    const end = closing(line, 0, from.open);
    if (end < 0) {
      push('string', line);
      return { segments, state: from };
    }
    push('string', line.slice(0, end));
    return { segments, state: value(line.slice(end), push) };
  }
  const indent = /^\s*/.exec(line)[0].length;
  push(null, line.slice(0, indent));
  const rest = line.slice(indent);
  if (!rest) return { segments, state: START };
  if (rest[0] === '#') {
    push('comment', rest);
    return { segments, state: START };
  }
  const header = /^(\[\[[^\]]*\]\]|\[[^\]]*\])/.exec(rest);
  if (header && !/^\[[^\]]*\]\s*=/.test(rest)) {
    push('function', header[1]);
    return { segments, state: value(rest.slice(header[1].length), push) };
  }
  const key = KEY.exec(rest);
  if (key) {
    push('key', key[0]);
    const equals = /^(\s*)=/.exec(rest.slice(key[0].length));
    push(null, equals[1]);
    push('punct', '=');
    return { segments, state: value(rest.slice(key[0].length + equals[0].length), push) };
  }
  return { segments, state: value(rest, push) };
}

export const TomlHighlighter = highlighterFor(START, scan);
