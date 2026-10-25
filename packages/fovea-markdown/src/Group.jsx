import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { render } from './blocks.js';
import { sanitizeToFragment } from './sanitize.js';

const LINE_ESTIMATE = 22;
const BLOCK_ESTIMATE = 14;
const NEAR = '1500px 0px';

/**
 * @param {import('./blocks.js').Block[]} blocks
 * @returns {number} A guess at the height of the blocks, in pixels, from the lines they cover.
 */
const estimate = (blocks) =>
  blocks.reduce((sum, b) => sum + Math.max(1, b.end - b.start) * LINE_ESTIMATE + BLOCK_ESTIMATE, 0);

/**
 * A group of blocks. It is drawn when it is near the screen or is wanted, and otherwise is an empty
 * space as tall as it was, so the scrollbar stays steady however long the file is.
 *
 * @param {object} props
 * @param {number} props.index The position of this group.
 * @param {number} props.first The index of its first block.
 * @param {import('./blocks.js').Block[]} props.blocks
 * @param {import('./blocks.js').Markdown} props.md
 * @param {HTMLElement | null} props.root The scrolling element, for knowing what is near.
 * @param {boolean} props.wanted Draw it even when it is far off, because something needs it.
 * @param {(frame: HTMLElement, index: number) => void} props.onDrawn Called once it is drawn and
 *   wanted.
 */
export function Group({ index, first, blocks, md, root, wanted, onDrawn }) {
  const frame = useRef(/** @type {HTMLDivElement | null} */ (null));
  // Without IntersectionObserver (old browsers, tests), everything is drawn.
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  const draw = near || wanted;
  const shown = useRef(/** @type {{ blocks: unknown, md: unknown } | null} */ (null));

  useEffect(() => {
    const element = frame.current;
    if (!element || !root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: NEAR,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [root]);

  // The blocks are set in the group directly, as cleaned DOM rather than an HTML string. When they
  // are dropped, the group keeps the height they had.
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (draw) {
      // Already drawn from these blocks: leave the nodes alone (React may run this twice).
      if (shown.current?.blocks === blocks && shown.current.md === md && element.firstChild) return;
      shown.current = { blocks, md };
      const html = blocks
        .map((b, i) => `<div data-block="${first + i}">${render(md, b)}</div>`)
        .join('');
      element.style.height = '';
      // The cleaned nodes are made in a separate document, so move them into this one first.
      element.replaceChildren(element.ownerDocument.adoptNode(sanitizeToFragment(html)));
    } else {
      shown.current = null;
      element.style.height = `${element.offsetHeight || estimate(blocks)}px`;
      element.replaceChildren();
    }
  }, [draw, blocks, md, first]);

  useLayoutEffect(() => {
    if (draw && wanted && frame.current) onDrawn(frame.current, index);
  }, [draw, wanted, onDrawn, index]);

  return <div ref={frame} data-group={index} />;
}
