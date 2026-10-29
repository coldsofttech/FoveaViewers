// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * Colours the lines of a text one at a time, whichever are asked for, in any order, for a language
 * whose colouring of a line depends only on a small state at the start of it.
 *
 * @template S
 * @param {S} start The state at the start of the text.
 * @param {(line: string, from: S, collect: boolean) => {segments: Array<[string | null, string]> | null, state: S}} scan
 */
export function highlighterFor(start, scan) {
  return class Highlighter {
    /** @param {string[]} lines */
    constructor(lines) {
      this.lines = lines;
      this.starts = [start];
    }

    /** The `[kind, text]` pieces of line `index` (0-based). */
    segments(index) {
      for (let k = this.starts.length - 1; k < index; k++) {
        this.starts[k + 1] = scan(this.lines[k], this.starts[k], false).state;
      }
      return scan(this.lines[index], this.starts[index]).segments;
    }
  };
}

/** A collector of `[kind, text]` pieces that joins neighbours of one kind. */
export function collector(collect) {
  const segments = collect ? [] : null;
  const push = (kind, text) => {
    if (!collect || !text) return;
    const last = segments[segments.length - 1];
    if (last && last[0] === kind) last[1] += text;
    else segments.push([kind, text]);
  };
  return { segments, push };
}

/** A state object for a language, one per distinct combination (so states compare by identity). */
export function interner() {
  const known = new Map();
  return (key, make) => {
    let found = known.get(key);
    if (!found) {
      found = make();
      known.set(key, found);
    }
    return found;
  };
}
