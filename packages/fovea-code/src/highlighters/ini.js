// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.

/** INI: a line tokenizer. Every line is coloured on its own (a continuation is just a value). */
import { collector, highlighterFor } from './highlighter.js';

const PAIR = /^([^=:[\];#][^=:]*?)(\s*)([=:])(.*)$/;

/** Colours one line. State-free: `from` and the returned `state` are always `null`. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  const indent = /^\s*/.exec(line)[0].length;
  push(null, line.slice(0, indent));
  const rest = line.slice(indent);
  if (!rest) return { segments, state: null };
  if (rest[0] === ';' || rest[0] === '#') {
    push('comment', rest);
    return { segments, state: null };
  }
  const header = /^(\[[^\]]*\]?)(.*)$/.exec(rest);
  if (header) {
    push('function', header[1]);
    push(null, header[2]);
    return { segments, state: null };
  }
  const pair = indent === 0 ? PAIR.exec(rest) : null;
  if (pair) {
    push('key', pair[1]);
    push(null, pair[2]);
    push('punct', pair[3]);
    const value = pair[4];
    const lead = /^\s*/.exec(value)[0];
    push(null, lead);
    const body = value.slice(lead.length);
    const kind = /^(true|false|yes|no|on|off)$/i.test(body.trim())
      ? 'constant'
      : /^[-+]?\d[\d_.]*$/.test(body.trim())
        ? 'number'
        : 'string';
    push(kind, body);
    return { segments, state: null };
  }
  push(indent ? 'string' : 'key', rest);
  return { segments, state: null };
}

export const IniHighlighter = highlighterFor(null, scan);
