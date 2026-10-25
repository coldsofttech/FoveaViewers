// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * YAML: a line tokenizer. The state carried from line to line is only whether a block scalar (`|`
 * or `>`) is open, and how far its parent was indented, so any window of lines can be coloured.
 */
import { collector, highlighterFor, interner } from './highlighter.js';

const intern = interner();
const state = (block) => intern(`${block}`, () => ({ block }));

/** The state at the start of a document (no block scalar open). */
export const START = state(-1);

const NUMBER =
  /^[-+]?(?:0x[\da-fA-F_]+|0o[0-7_]+|(?:\d[\d_]*)(?:\.[\d_]*)?(?:[eE][-+]?\d+)?|\.\d+|\.inf|\.nan)$/i;
const CONSTANT = /^(true|false|null|yes|no|on|off|~)$/i;
const KEY = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#'"[\]{},&*!|>%@`][^#]*?)(?=\s*:(?:\s|$))/;

/** A value (the rest of a line after `key:` or `- `): its tokens. */
function value(rest, push) {
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < rest.length && /\s/.test(rest[j])) j++;
      push(null, rest.slice(i, j));
      i = j;
    } else if (ch === '#' && (i === 0 || /\s/.test(rest[i - 1]))) {
      push('comment', rest.slice(i));
      return;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < rest.length && rest[j] !== ch) j += ch === '"' && rest[j] === '\\' ? 2 : 1;
      push('string', rest.slice(i, Math.min(rest.length, j + 1)));
      i = Math.min(rest.length, j + 1);
    } else if (/[[\]{},]/.test(ch)) {
      push('punct', ch);
      i++;
    } else if (ch === '&' || ch === '*' || ch === '!') {
      let j = i + 1;
      while (j < rest.length && !/[\s,\]}]/.test(rest[j])) j++;
      push('function', rest.slice(i, j));
      i = j;
    } else {
      // A plain scalar, up to the end of the line, a comment, or a flow separator.
      let j = i;
      while (
        j < rest.length &&
        !/[,\]}]/.test(rest[j]) &&
        !(rest[j] === '#' && /\s/.test(rest[j - 1] ?? ''))
      )
        j++;
      const word = rest.slice(i, j);
      const trimmed = word.trimEnd();
      const kind = NUMBER.test(trimmed) ? 'number' : CONSTANT.test(trimmed) ? 'constant' : 'string';
      push(kind, trimmed);
      push(null, word.slice(trimmed.length));
      i = j;
    }
  }
}

/** Colours one line. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  const indent = /^\s*/.exec(line)[0].length;
  if (from.block >= 0) {
    if (!line.trim() || indent > from.block) {
      push('string', line);
      return { segments, state: from };
    }
  }
  push(null, line.slice(0, indent));
  let rest = line.slice(indent);
  if (!rest) return { segments, state: START };
  if (/^(---|\.\.\.)(\s|$)/.test(rest)) {
    push('punct', rest.slice(0, 3));
    value(rest.slice(3), push);
    return { segments, state: START };
  }
  if (rest[0] === '#') {
    push('comment', rest);
    return { segments, state: START };
  }
  let parent = indent;
  // Sequence dashes, however many are stacked (`- - a`).
  for (let dash = /^-(\s+|$)/.exec(rest); dash; dash = /^-(\s+|$)/.exec(rest)) {
    push('punct', '-');
    push(null, dash[1]);
    parent += dash[0].length;
    rest = rest.slice(dash[0].length);
  }
  const key = KEY.exec(rest);
  if (key) {
    push('key', key[0]);
    rest = rest.slice(key[0].length);
    const colon = /^(\s*):/.exec(rest);
    push(null, colon[1]);
    push('punct', ':');
    rest = rest.slice(colon[0].length);
  }
  const indicator = /^\s*([|>][-+\d]*)\s*(#.*)?$/.exec(rest);
  if (indicator) {
    const lead = rest.slice(0, rest.indexOf(indicator[1]));
    push(null, lead);
    push('function', indicator[1]);
    const tail = rest.slice(lead.length + indicator[1].length);
    if (tail) value(tail, push);
    const block = key ? parent : indent;
    return { segments, state: state(block) };
  }
  value(rest, push);
  return { segments, state: START };
}

export const YamlHighlighter = highlighterFor(START, scan);
