// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * SQL: a line tokenizer. The state carried from line to line is only whether a block comment is
 * open, so any window of lines can be coloured. A string runs to the end of its line.
 */
import { collector, highlighterFor, interner } from './highlighter.js';

const intern = interner();
const state = (block) => intern(`${block}`, () => ({ block }));

/** The state at the start of a script (no comment open). */
export const START = state(false);
const OPEN = state(true);

const KEYWORDS = new Set(
  (
    'select from where and or not in is like between exists case when then else end as on join ' +
    'inner left right full outer cross natural using group by order having limit offset union all ' +
    'distinct insert into values update set delete create alter drop truncate table view index ' +
    'database schema if primary key foreign references unique default check constraint add column ' +
    'rename to begin commit rollback transaction with recursive returning grant revoke asc desc ' +
    'over partition replace explain analyze declare return returns function procedure trigger'
  ).split(' '),
);
const TYPES = new Set(
  (
    'int integer bigint smallint tinyint serial bigserial decimal numeric float double real ' +
    'boolean bool bit char varchar nchar nvarchar text clob blob bytea date time timestamp ' +
    'datetime interval json jsonb uuid money'
  ).split(' '),
);

/** Colours one line. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  let i = 0;
  let block = from.block;
  while (i < line.length) {
    if (block) {
      const end = line.indexOf('*/', i);
      if (end < 0) {
        push('comment', line.slice(i));
        return { segments, state: OPEN };
      }
      push('comment', line.slice(i, end + 2));
      i = end + 2;
      block = false;
      continue;
    }
    const ch = line[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      push(null, line.slice(i, j));
      i = j;
    } else if (line.startsWith('--', i) || ch === '#') {
      push('comment', line.slice(i));
      return { segments, state: START };
    } else if (line.startsWith('/*', i)) {
      block = true;
      push('comment', '/*');
      i += 2;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === ch) {
          if (line[j + 1] === ch) j += 2;
          else break;
        } else j += ch === "'" && line[j] === '\\' ? 2 : 1;
      }
      const end = Math.min(line.length, j + 1);
      push(ch === "'" ? 'string' : 'identifier', line.slice(i, end));
      i = end;
    } else if (/\d/.test(ch)) {
      const found = /^\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(line.slice(i));
      push('number', found[0]);
      i += found[0].length;
    } else if (/[A-Za-z_@$]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[\w$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const lower = word.toLowerCase();
      const call = /^\s*\(/.test(line.slice(j));
      push(
        KEYWORDS.has(lower)
          ? 'keyword'
          : TYPES.has(lower)
            ? 'storage'
            : lower === 'true' || lower === 'false' || lower === 'null'
              ? 'constant'
              : call
                ? 'function'
                : null,
        word,
      );
      i = j;
    } else if (/[(),;.=<>+\-*/%|&^~!:[\]]/.test(ch)) {
      push('punct', ch);
      i++;
    } else {
      push(null, ch);
      i++;
    }
  }
  return { segments, state: block ? OPEN : START };
}

export const SqlHighlighter = highlighterFor(START, scan);
