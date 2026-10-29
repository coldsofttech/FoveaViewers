import { piecesOf } from './pieces.js';
import styles from './TextViewer.module.css';

/**
 * One line of text with its number. `segments` colour it in pieces, and `mark` (`{from, to}`, in
 * characters) is drawn highlighted.
 *
 * @param {object} props
 * @param {number} props.number The line number, from 1.
 * @param {string} props.text
 * @param {Array<[string | null, string]> | null} props.segments Coloured pieces that make up the
 *   line, or `null` for plain text.
 * @param {{ from: number, to: number } | null} props.mark
 * @param {boolean} props.current Whether this is the target line.
 * @param {number} props.top Distance from the top of the content, in pixels.
 * @param {number} props.height Height of the line, in pixels.
 * @param {number} props.digits How many digits the widest line number has.
 */
export function Line({ number, text, segments, mark, current, top, height, digits }) {
  return (
    <div
      className={current ? `${styles.line} ${styles.current}` : styles.line}
      data-line={number}
      style={{ top, height, lineHeight: `${height}px` }}
    >
      <span className={styles.gutter} style={{ width: `${digits + 2}ch` }} aria-hidden="true">
        {number}
      </span>
      <span className={styles.text}>
        {segments || mark
          ? piecesOf(text, segments, mark).map((piece, i) => {
              const style = piece.kind
                ? { color: `var(--fovea-token-${piece.kind}, inherit)` }
                : undefined;
              return piece.hit ? (
                <mark key={i} className={styles.hit} style={style}>
                  {piece.text}
                </mark>
              ) : (
                <span key={i} style={style}>
                  {piece.text}
                </span>
              );
            })
          : text}
      </span>
    </div>
  );
}
