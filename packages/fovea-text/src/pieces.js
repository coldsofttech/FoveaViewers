/**
 * The pieces a line is drawn in: its coloured segments, cut at the ends of the marked characters.
 *
 * @param {string} text The line.
 * @param {Array<[string | null, string]> | null} segments `[kind, text]` pieces that make up the line.
 * @param {{ from: number, to: number } | null} mark Characters to mark.
 * @returns {Array<{ kind: string | null, text: string, hit: boolean }>}
 */
export function piecesOf(text, segments, mark) {
  /** @type {Array<[string | null, string]>} */
  const parts = segments ?? [[null, text]];
  /** @type {Array<{ kind: string | null, text: string, hit: boolean }>} */
  const out = [];
  let at = 0;
  for (const [kind, piece] of parts) {
    const end = at + piece.length;
    if (!mark || mark.to <= at || mark.from >= end) {
      out.push({ kind, text: piece, hit: false });
    } else {
      const from = Math.max(mark.from, at) - at;
      const to = Math.min(mark.to, end) - at;
      if (from > 0) out.push({ kind, text: piece.slice(0, from), hit: false });
      out.push({ kind, text: piece.slice(from, to), hit: true });
      if (to < piece.length) out.push({ kind, text: piece.slice(to), hit: false });
    }
    at = end;
  }
  return out;
}
