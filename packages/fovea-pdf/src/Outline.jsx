import styles from './PdfViewer.module.css';

/**
 * @typedef {object} OutlineItem
 * @property {string} title
 * @property {unknown} dest Where the item goes: a name, a destination, or nothing.
 * @property {OutlineItem[]} items The items under it.
 */

/**
 * The outline of a PDF (its table of contents) as nested lists of buttons.
 *
 * @param {{ items: OutlineItem[], onGo: (dest: unknown) => void }} props
 */
export function Outline({ items, onGo }) {
  return (
    <ul className={styles.outline}>
      {items.map((item, index) => (
        <li key={index}>
          {item.dest ? (
            <button type="button" className={styles.outlineButton} onClick={() => onGo(item.dest)}>
              {item.title}
            </button>
          ) : (
            <span className={styles.outlineText}>{item.title}</span>
          )}
          {item.items.length > 0 && <Outline items={item.items} onGo={onGo} />}
        </li>
      ))}
    </ul>
  );
}
