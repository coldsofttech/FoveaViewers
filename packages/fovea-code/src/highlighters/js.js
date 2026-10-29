// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * JavaScript: a lexer (not a parser, so it never fails on odd code and stays fast on a minified
 * bundle) and a rough layout for minified files.
 *
 * The state carried from line to line is whether a block comment is open and how deep in template
 * literals the line starts; a regular expression is told from a division by what comes before it on
 * the line, so a regex at the start of a line after an expression is coloured as a division.
 */
import { collector, highlighterFor, interner } from './highlighter.js';

const intern = interner();
// `stack`: one char per open template context: 'T' text of a template, 'E' an expression in it
// (`${`), '{' a brace opened inside such an expression.
const state = (comment, stack) => intern(`${comment ? 1 : 0}|${stack}`, () => ({ comment, stack }));

/** The state at the start of a script. */
export const START = state(false, '');

const CONTROL = new Set(
  'if else for while do switch case default break continue return throw try catch finally import export from as await yield new delete typeof instanceof in of void with debugger'.split(
    ' ',
  ),
);
const STORAGE = new Set(
  'const let var function class extends static get set async enum interface type implements public private protected readonly abstract declare namespace module'.split(
    ' ',
  ),
);
const CONSTANT = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'this',
  'super',
  'NaN',
  'Infinity',
]);

const IDENT_START = /[A-Za-z_$\u0080-\uffff]/;
const IDENT = /[\w$\u0080-\uffff]/;

const readQuoted = (line, i) => {
  const quote = line[i];
  let j = i + 1;
  while (j < line.length && line[j] !== quote) j += line[j] === '\\' ? 2 : 1;
  return Math.min(line.length, j + 1);
};

const readRegex = (line, i) => {
  let j = i + 1;
  let inClass = false;
  while (j < line.length) {
    const ch = line[j];
    if (ch === '\\') j += 2;
    else if (ch === '[') {
      inClass = true;
      j++;
    } else if (ch === ']') {
      inClass = false;
      j++;
    } else if (ch === '/' && !inClass) break;
    else j++;
  }
  if (j >= line.length) return -1; // not a regex: a division
  j++;
  while (j < line.length && /[a-z]/i.test(line[j])) j++;
  return j;
};

const readNumber = (line, i) => {
  let j = i;
  if (line[j] === '0' && /[xXoObB]/.test(line[j + 1] ?? '')) {
    j += 2;
    while (j < line.length && /[\da-fA-F_]/.test(line[j])) j++;
  } else {
    while (j < line.length && /[\d_]/.test(line[j])) j++;
    if (line[j] === '.') {
      j++;
      while (j < line.length && /[\d_]/.test(line[j])) j++;
    }
    if (/[eE]/.test(line[j] ?? '') && /[\d+-]/.test(line[j + 1] ?? '')) {
      j += 2;
      while (j < line.length && /\d/.test(line[j])) j++;
    }
  }
  if (line[j] === 'n') j++;
  return j;
};

/** Colours one line. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  let { comment, stack } = from;
  let i = 0;
  let previous = ''; // the last significant token: 'value' (an operand), or the punctuation char
  // Text of a template literal, from `i` to the closing backtick or a `${`; true when it closes.
  const template = () => {
    let j = i;
    while (j < line.length) {
      if (line[j] === '\\') j += 2;
      else if (line[j] === '`') {
        push('string', line.slice(i, j + 1));
        i = j + 1;
        stack = stack.slice(0, -1);
        previous = 'value';
        return;
      } else if (line[j] === '$' && line[j + 1] === '{') {
        push('string', line.slice(i, j));
        push('punct', '${');
        i = j + 2;
        stack += 'E';
        previous = '(';
        return;
      } else j++;
    }
    push('string', line.slice(i));
    i = line.length;
  };
  while (i < line.length) {
    if (comment) {
      const end = line.indexOf('*/', i);
      push('comment', end === -1 ? line.slice(i) : line.slice(i, end + 2));
      if (end === -1) i = line.length;
      else {
        i = end + 2;
        comment = false;
      }
      continue;
    }
    if (stack.endsWith('T')) {
      template();
      continue;
    }
    const ch = line[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      push(null, line.slice(i, j));
      i = j;
    } else if (ch === '/' && line[i + 1] === '/') {
      push('comment', line.slice(i));
      i = line.length;
    } else if (ch === '/' && line[i + 1] === '*') {
      comment = true;
      push('comment', '/*');
      i += 2;
    } else if (ch === '#' && i === 0 && line[1] === '!') {
      push('comment', line);
      i = line.length;
    } else if (ch === '"' || ch === "'") {
      const end = readQuoted(line, i);
      push('string', line.slice(i, end));
      i = end;
      previous = 'value';
    } else if (ch === '`') {
      push('string', '`');
      i++;
      stack += 'T';
    } else if (ch === '/' && previous !== 'value') {
      const end = readRegex(line, i);
      if (end === -1) {
        push('punct', ch);
        i++;
      } else {
        push('regexp', line.slice(i, end));
        i = end;
        previous = 'value';
      }
    } else if (/\d/.test(ch) || (ch === '.' && /\d/.test(line[i + 1] ?? ''))) {
      const end = readNumber(line, i);
      push('number', line.slice(i, end));
      i = end;
      previous = 'value';
    } else if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < line.length && IDENT.test(line[j])) j++;
      const word = line.slice(i, j);
      const before = line.slice(0, i).trimEnd();
      const afterDot = before.endsWith('.') && !before.endsWith('..');
      let kind;
      if (afterDot) kind = line[j] === '(' ? 'function' : 'member';
      else if (CONTROL.has(word)) kind = 'keyword';
      else if (STORAGE.has(word)) kind = 'storage';
      else if (CONSTANT.has(word)) kind = 'constant';
      else if (line[j] === '(') kind = 'function';
      else kind = 'identifier';
      push(kind, word);
      i = j;
      previous = kind === 'keyword' && !['this'].includes(word) ? 'keyword' : 'value';
    } else {
      if (ch === '{' && stack.endsWith('E')) stack += '{';
      else if (ch === '}' && stack.endsWith('{')) stack = stack.slice(0, -1);
      else if (ch === '}' && stack.endsWith('E')) {
        stack = stack.slice(0, -1);
        push('punct', '}');
        i++;
        continue;
      }
      push('punct', ch);
      i++;
      previous = ch === ')' || ch === ']' || ch === '}' ? 'value' : ch;
    }
  }
  return { segments, state: state(comment, stack) };
}

export const JsHighlighter = highlighterFor(START, scan);

/**
 * A script laid out roughly: a new line after `{`, `;` and `}`, indented by braces. Strings,
 * template literals, comments, regular expressions and the insides of parentheses (a `for (;;)`)
 * are left alone. It does not rewrite anything: this is for reading a minified file.
 *
 * @param {string} text
 * @returns {string}
 */
export function formatJs(text) {
  const out = [];
  let line = '';
  let depth = 0;
  let parens = 0;
  let previous = '';
  const flush = () => {
    if (line.trim()) out.push('  '.repeat(Math.max(0, depth)) + line.trim());
    line = '';
  };
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const end = readQuoted(text, i);
      line += text.slice(i, end);
      i = end;
      previous = 'value';
    } else if (ch === '`') {
      let j = i + 1;
      let nest = 0;
      while (j < text.length) {
        if (text[j] === '\\') j += 2;
        else if (text[j] === '$' && text[j + 1] === '{') {
          nest++;
          j += 2;
        } else if (text[j] === '}' && nest) {
          nest--;
          j++;
        } else if (text[j] === '`' && !nest) break;
        else j++;
      }
      line += text.slice(i, j + 1);
      i = j + 1;
      previous = 'value';
    } else if (ch === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      line += text.slice(i, end === -1 ? text.length : end);
      flush();
      i = end === -1 ? text.length : end + 1;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      flush();
      for (const row of text.slice(i, stop).split('\n')) {
        if (row.trim()) out.push('  '.repeat(Math.max(0, depth)) + row.trim());
      }
      i = stop;
    } else if (ch === '/' && previous !== 'value') {
      const end = readRegex(text.slice(i, i + 2000), 0);
      if (end === -1) {
        line += ch;
        i++;
      } else {
        line += text.slice(i, i + end);
        i += end;
        previous = 'value';
      }
    } else if (/\s/.test(ch)) {
      if (ch === '\n' && line.trim() === '') line = '';
      else if (line && !line.endsWith(' ')) line += ' ';
      i++;
    } else if (ch === '(') {
      parens++;
      line += ch;
      i++;
      previous = '(';
    } else if (ch === ')') {
      parens = Math.max(0, parens - 1);
      line += ch;
      i++;
      previous = 'value';
    } else if (parens === 0 && ch === '{') {
      line = `${line.trimEnd()} {`.trimStart();
      flush();
      depth++;
      i++;
      previous = '{';
    } else if (parens === 0 && ch === '}') {
      flush();
      depth = Math.max(0, depth - 1);
      line += ch;
      i++;
      // `} else`, `});` and `},` stay with their brace.
      const next = /^\s*(else\b|catch\b|finally\b|[);,])/.exec(text.slice(i));
      if (!next) flush();
      else if (/^[a-z]/.test(next[1])) line += ' ';
      previous = 'value';
    } else if (parens === 0 && ch === ';') {
      line += ch;
      flush();
      i++;
      previous = ';';
    } else {
      line += ch;
      i++;
      previous = /[\w$\])]/.test(ch) ? 'value' : ch;
    }
  }
  flush();
  return out.join('\n');
}
