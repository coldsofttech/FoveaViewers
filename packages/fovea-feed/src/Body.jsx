import { useLayoutEffect, useRef } from 'react';
import { sanitizeToFragment } from './sanitize.js';
import styles from './FeedViewer.module.css';

/**
 * The body of a feed entry: plain text, or its HTML cleaned when the host asked for rich text.
 *
 * @param {object} props
 * @param {string} props.text The body as plain text.
 * @param {string | null} props.html The body as HTML, when the feed gave it as HTML.
 * @param {boolean} props.rich Show the HTML rather than the text.
 * @param {boolean} props.allowImages Keep the pictures in the HTML.
 */
export function Body({ text, html, rich, allowImages }) {
  const element = useRef(/** @type {HTMLDivElement | null} */ (null));
  const showHtml = rich && html !== null;
  const drawn = useRef(/** @type {{ html: string | null, allowImages: boolean } | null} */ (null));

  // The cleaned HTML is set in the element directly, as DOM rather than an HTML string.
  useLayoutEffect(() => {
    const target = element.current;
    if (!target || !rich || html === null) return;
    // Already drawn from this HTML: leave the nodes alone, as marks may have been put in them.
    if (
      drawn.current?.html === html &&
      drawn.current.allowImages === allowImages &&
      target.firstChild
    ) {
      return;
    }
    drawn.current = { html, allowImages };
    // The cleaned nodes are made in a separate document, so move them into this one first.
    target.replaceChildren(target.ownerDocument.adoptNode(sanitizeToFragment(html, allowImages)));
  }, [html, rich, allowImages]);

  if (showHtml) return <div ref={element} className={styles.rich} />;
  return text ? <p className={styles.text}>{text}</p> : null;
}
