// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.

/** reStructuredText: a line tokenizer. Every line is coloured on its own. */
import { collector, highlighterFor } from './highlighter.js';

const ADORNMENT = /^([!-/:-@[-`{-~])\1{2,}\s*$/;
const INLINE = /(``[^`]+``|\*\*[^*]+\*\*|:[\w.+-]+:`[^`]*`|`[^`]+`__?)/;

/** The inline markup of a run of prose. */
function prose(text, push) {
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith('``')) push('string', part);
    else if (part.startsWith('**')) push('keyword', part);
    else if (part.startsWith(':') || part.startsWith('`')) push('function', part);
    else push(null, part);
  }
}

/** Colours one line. State-free: `from` and the returned `state` are always `null`. */
export function scan(line, from, collect = true) {
  const { segments, push } = collector(collect);
  const indent = /^\s*/.exec(line)[0].length;
  push(null, line.slice(0, indent));
  const rest = line.slice(indent);
  if (!rest) return { segments, state: null };
  if (ADORNMENT.test(rest) || /^[=\s]{3,}$/.test(rest)) {
    push('atrule', rest);
    return { segments, state: null };
  }
  const directive = /^(\.\.\s+)([\w:+-]+::)(.*)$/.exec(rest);
  if (directive) {
    push('punct', directive[1]);
    push('function', directive[2]);
    prose(directive[3], push);
    return { segments, state: null };
  }
  if (rest.startsWith('..')) {
    push('comment', rest);
    return { segments, state: null };
  }
  const field = /^(:[^:\n]+:)(\s.*|)$/.exec(rest);
  if (field) {
    push('key', field[1]);
    prose(field[2], push);
    return { segments, state: null };
  }
  const bullet = /^([-*+]|\d+[.)])(\s+)(.*)$/.exec(rest);
  if (bullet) {
    push('punct', bullet[1]);
    push(null, bullet[2]);
    prose(bullet[3], push);
    return { segments, state: null };
  }
  prose(rest, push);
  return { segments, state: null };
}

export const RstHighlighter = highlighterFor(null, scan);
