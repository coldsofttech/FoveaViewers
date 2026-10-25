import styles from './TextViewer.module.css';

/**
 * One line of text with its number. `mark` (`{from, to}`, in characters) is drawn highlighted.
 *
 * @param {object} props
 * @param {number} props.number The line number, from 1.
 * @param {string} props.text
 * @param {{ from: number, to: number } | null} props.mark
 * @param {boolean} props.current Whether this is the target line.
 * @param {number} props.top Distance from the top of the content, in pixels.
 * @param {number} props.height Height of the line, in pixels.
 * @param {number} props.digits How many digits the widest line number has.
 */
export function Line({ number, text, mark, current, top, height, digits }) {
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
        {mark ? (
          <>
            {text.slice(0, mark.from)}
            <mark className={styles.hit}>{text.slice(mark.from, mark.to)}</mark>
            {text.slice(mark.to)}
          </>
        ) : (
          text
        )}
      </span>
    </div>
  );
}
