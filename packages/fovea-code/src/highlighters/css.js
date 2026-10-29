// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * A CSS tokenizer for colouring a stylesheet line by line, and a formatter for minified ones.
 *
 * A line is coloured knowing only the state at its start (inside a comment? how deep in blocks, and
 * of what kind? in a value? which at-rule's prelude?), so a viewer that shows a window of lines
 * can colour any of them: `CssHighlighter` finds the state at a line by reading the lines before
 * it once and remembering where each one started.
 */

/** The kinds of token, for a palette to colour. */
export const KINDS = [
  'comment',
  'atrule',
  'selector',
  'property',
  'value',
  'string',
  'number',
  'function',
  'important',
  'punct',
];

// At-rules whose block holds rules (the others, `@font-face` and the like, hold declarations).
const GROUPS = new Set([
  'media',
  'supports',
  'layer',
  'container',
  'document',
  'keyframes',
  'scope',
  'starting-style',
]);

const interned = new Map();
const state = (comment, stack, value, at) => {
  const key = `${comment ? 1 : 0}|${stack}|${value ? 1 : 0}|${at}`;
  let found = interned.get(key);
  if (!found) {
    found = { comment, stack, value, at };
    interned.set(key, found);
  }
  return found;
};

/** The state at the start of a stylesheet. */
export const START = state(false, '', false, '');

const IDENT_START = /[-_a-zA-Z\u0080-￿]/;
const IDENT = /[-\w\u0080-￿]/;
const DIGIT = /\d/;

const isNumberAt = (line, i) => {
  const ch = line[i];
  if (DIGIT.test(ch)) return true;
  if (ch === '.' && DIGIT.test(line[i + 1] ?? '')) return true;
  return (
    (ch === '+' || ch === '-') &&
    (DIGIT.test(line[i + 1] ?? '') || (line[i + 1] === '.' && DIGIT.test(line[i + 2] ?? '')))
  );
};

const readNumber = (line, i) => {
  let j = i;
  if (line[j] === '+' || line[j] === '-') j++;
  while (j < line.length && DIGIT.test(line[j])) j++;
  if (line[j] === '.' && DIGIT.test(line[j + 1] ?? '')) {
    j++;
    while (j < line.length && DIGIT.test(line[j])) j++;
  }
  if ((line[j] === 'e' || line[j] === 'E') && /[\d+-]/.test(line[j + 1] ?? '')) {
    j++;
    if (line[j] === '+' || line[j] === '-') j++;
    while (j < line.length && DIGIT.test(line[j])) j++;
  }
  // The unit: px, em, %...
  if (line[j] === '%') j++;
  else while (j < line.length && /[a-zA-Z]/.test(line[j])) j++;
  return j;
};

const readString = (line, i) => {
  const quote = line[i];
  let j = i + 1;
  while (j < line.length && line[j] !== quote) j += line[j] === '\\' ? 2 : 1;
  return Math.min(line.length, j + 1);
};

/** One token of a value (or of an at-rule's prelude) at `i`: its kind and where it ends. */
function valueToken(line, i) {
  const ch = line[i];
  if (ch === '"' || ch === "'") return ['string', readString(line, i)];
  if (ch === '#') {
    let j = i + 1;
    while (j < line.length && /[0-9a-fA-F]/.test(line[j])) j++;
    return j > i + 1 ? ['number', j] : ['punct', i + 1];
  }
  if (ch === '!') {
    const word = /^!\s*important/i.exec(line.slice(i));
    return word ? ['important', i + word[0].length] : ['punct', i + 1];
  }
  const dashes = ch === '-' && line[i + 1] === '-';
  if (!dashes && isNumberAt(line, i)) return ['number', readNumber(line, i)];
  if (IDENT_START.test(ch)) {
    let j = i + 1;
    while (j < line.length && IDENT.test(line[j])) j++;
    if (line[j] === '(') return ['function', j];
    return [dashes ? 'property' : 'value', j];
  }
  return ['punct', i + 1];
}

/**
 * Colours one line.
 *
 * @param {string} line
 * @param {object} from The state at the start of the line.
 * @param {boolean} [collect] Make the segments (false: only find the state at the end).
 * @returns {{segments: Array<[string, string]> | null, state: object}} `[kind, text]` pieces
 *   that together are the line, and the state at its end.
 */
export function scan(line, from, collect = true) {
  let { comment, stack, value, at } = from;
  const segments = collect ? [] : null;
  const push = (kind, text) => {
    if (!collect || !text) return;
    const last = segments[segments.length - 1];
    if (last && last[0] === kind) last[1] += text;
    else segments.push([kind, text]);
  };
  let i = 0;
  while (i < line.length) {
    if (comment) {
      const end = line.indexOf('*/', i);
      if (end === -1) {
        push('comment', line.slice(i));
        i = line.length;
      } else {
        push('comment', line.slice(i, end + 2));
        i = end + 2;
        comment = false;
      }
      continue;
    }
    const ch = line[i];
    if (ch === '/' && line[i + 1] === '*') {
      comment = true;
      push('comment', '/*');
      i += 2;
      continue;
    }
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      push('punct', line.slice(i, j));
      i = j;
      continue;
    }
    const context = stack.length ? stack[stack.length - 1] : 'g';
    if (ch === '}') {
      stack = stack.slice(0, -1);
      value = false;
      at = '';
      push('punct', ch);
      i++;
      continue;
    }
    if (context === 'g') {
      // Rules: selectors, at-rules.
      if (ch === '{') {
        const group = GROUPS.has(at.replace(/^-\w+-/, ''));
        stack += group ? 'g' : 'd';
        at = '';
        push('punct', ch);
        i++;
      } else if (ch === ';') {
        at = '';
        push('punct', ch);
        i++;
      } else if (ch === '@') {
        let j = i + 1;
        while (j < line.length && IDENT.test(line[j])) j++;
        at = line.slice(i + 1, j).toLowerCase();
        push('atrule', line.slice(i, j));
        i = j;
      } else if (ch === '"' || ch === "'") {
        const end = readString(line, i);
        push('string', line.slice(i, end));
        i = end;
      } else if (at) {
        const [kind, end] = valueToken(line, i);
        push(kind, line.slice(i, end));
        i = end;
      } else {
        let j = i;
        while (
          j < line.length &&
          !/[\s{};"'@]/.test(line[j]) &&
          !(line[j] === '/' && line[j + 1] === '*')
        )
          j++;
        push('selector', line.slice(i, j === i ? i + 1 : j));
        i = j === i ? i + 1 : j;
      }
      continue;
    }
    // Declarations.
    if (!value) {
      if (ch === ';') {
        push('punct', ch);
        i++;
        continue;
      }
      if (ch === '{') {
        stack += 'd';
        push('punct', ch);
        i++;
        continue;
      }
      // A nested rule's selector, or a property: whichever of `{` or `;` or `}` comes first says.
      const rest = line.slice(i);
      const stop = rest.search(/[{;}]/);
      if (stop !== -1 && rest[stop] === '{') {
        push('selector', rest.slice(0, stop));
        i += stop;
        continue;
      }
      let j = i;
      while (
        j < line.length &&
        !/[\s:;{}]/.test(line[j]) &&
        !(line[j] === '/' && line[j + 1] === '*')
      )
        j++;
      push('property', line.slice(i, j === i ? i + 1 : j));
      i = j === i ? i + 1 : j;
      let k = i;
      while (k < line.length && /\s/.test(line[k])) k++;
      if (line[k] === ':') {
        push('punct', line.slice(i, k + 1));
        i = k + 1;
        value = true;
      }
      continue;
    }
    if (ch === ';') {
      value = false;
      push('punct', ch);
      i++;
      continue;
    }
    const [kind, end] = valueToken(line, i);
    // An unquoted address, `url(pic.png)`, is one string.
    if (
      kind === 'function' &&
      line.slice(i, end).toLowerCase() === 'url' &&
      !/^\(\s*["']/.test(line.slice(end))
    ) {
      const close = line.indexOf(')', end);
      push('function', line.slice(i, end));
      push('punct', '(');
      const stopAt = close === -1 ? line.length : close;
      push('string', line.slice(end + 1, stopAt));
      i = stopAt;
      continue;
    }
    push(kind, line.slice(i, end));
    i = end;
  }
  return { segments, state: state(comment, stack, value, at) };
}

/** Colours a stylesheet's lines, whichever are asked for, in any order. */
export class CssHighlighter {
  /** @param {string[]} lines */
  constructor(lines) {
    this.lines = lines;
    this.starts = [START];
  }

  /** The `[kind, text]` pieces of line `index` (0-based). */
  segments(index) {
    for (let k = this.starts.length - 1; k < index; k++) {
      this.starts[k + 1] = scan(this.lines[k], this.starts[k], false).state;
    }
    return scan(this.lines[index], this.starts[index]).segments;
  }
}

/**
 * A minified (or just long-lined) stylesheet, one declaration to a line, indented by block.
 * Strings, comments and the insides of parentheses (a `data:` address has `;` in it) are left alone.
 *
 * @param {string} text
 * @returns {string}
 */
export function formatCss(text) {
  const out = [];
  let depth = 0;
  let current = '';
  let parens = 0;
  const flush = () => {
    const line = current.trim();
    current = '';
    if (line) out.push('  '.repeat(Math.max(0, depth)) + line);
  };
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      flush();
      for (const row of text.slice(i, stop).split('\n')) {
        const trimmed = row.trim();
        if (trimmed) out.push('  '.repeat(Math.max(0, depth)) + trimmed);
      }
      i = stop;
    } else if (ch === '"' || ch === "'") {
      const end = readString(text, i);
      current += text.slice(i, end);
      i = end;
    } else if (/\s/.test(ch)) {
      if (current && !current.endsWith(' ')) current += ' ';
      i++;
    } else if (ch === '(') {
      parens++;
      current += ch;
      i++;
    } else if (ch === ')') {
      parens = Math.max(0, parens - 1);
      current += ch;
      i++;
    } else if (parens === 0 && ch === '{') {
      current = `${current.trim()} {`;
      flush();
      depth++;
      i++;
    } else if (parens === 0 && ch === '}') {
      flush();
      depth = Math.max(0, depth - 1);
      out.push(`${'  '.repeat(depth)}}`);
      i++;
    } else if (parens === 0 && ch === ';') {
      current += ';';
      flush();
      i++;
    } else {
      current += ch;
      i++;
    }
  }
  flush();
  return out.join('\n');
}
