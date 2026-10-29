/* eslint-disable security/detect-object-injection -- every index here is a number counted from the length of the array it reads. */
// Words are compared with spaces, case and these markup characters taken out, so a match in the
// rendered text can be found in the source, and the other way round.
const IGNORED = /[\s*_`~#>|\\]/;

/** How many squashed characters either side of a match are compared to choose between several. */
export const CONTEXT = 40;

/**
 * Whether a character is dropped before comparing.
 *
 * @param {string} ch
 * @returns {boolean}
 */
export const isIgnored = (ch) => IGNORED.test(ch);

/**
 * The text without spaces and markup characters, in lower case.
 *
 * @param {string | undefined} text
 * @returns {string}
 */
export function squash(text) {
  let out = '';
  for (const ch of (text ?? '').toLowerCase()) if (!IGNORED.test(ch)) out += ch;
  return out;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} How many characters `a` and `b` share at their ends.
 */
const commonSuffix = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} How many characters `a` and `b` share at their starts.
 */
const commonPrefix = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

/**
 * Finds `needle` in `hay`. When it occurs more than once, the occurrence whose surroundings look
 * most like `before` and `after` wins.
 *
 * @param {string} hay Squashed text to look in.
 * @param {string} needle Squashed words to find.
 * @param {string} before Squashed text that comes before the words.
 * @param {string} after Squashed text that comes after the words.
 * @returns {{ at: number, score: number }} Where the words start in `hay` (-1 when they are not
 *   there) and how many characters of `before` and `after` agree with their surroundings, so
 *   several texts can be compared for the best place.
 */
export function scoreMatch(hay, needle, before, after) {
  const head = before.slice(-CONTEXT);
  const tail = after.slice(0, CONTEXT);
  let best = -1;
  let bestScore = -1;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    const score =
      commonSuffix(head, hay.slice(Math.max(0, at - CONTEXT), at)) +
      commonPrefix(tail, hay.slice(at + needle.length, at + needle.length + CONTEXT));
    if (score > bestScore) {
      best = at;
      bestScore = score;
    }
  }
  return { at: best, score: bestScore };
}

/**
 * Finds `needle` in `hay`, as `scoreMatch` does, and gives only where.
 *
 * @param {string} hay Squashed text to look in.
 * @param {string} needle Squashed words to find.
 * @param {string} before Squashed text that comes before the words.
 * @param {string} after Squashed text that comes after the words.
 * @returns {number} Where the words start in `hay`, or -1 when they are not there.
 */
export function bestMatch(hay, needle, before, after) {
  return scoreMatch(hay, needle, before, after).at;
}
