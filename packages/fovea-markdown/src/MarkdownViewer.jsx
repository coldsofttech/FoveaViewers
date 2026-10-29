import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearMarks,
  markIn,
  themeVars,
  useLatest,
  useText,
} from '@coldsofttech/fovea-viewers/core';
import { anchorsOf, blockAt, blocksOf, createMarkdown } from './blocks.js';
import { Group } from './Group.jsx';
import styles from './MarkdownViewer.module.css';

/** Blocks are drawn (and dropped) a group at a time: a file of any length is a list of groups. */
export const GROUP = 40;

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 */

/**
 * @typedef {object} MarkdownViewerProps
 * @property {ViewerSource} source The Markdown file: a URL, a Blob or File, or an ArrayBuffer
 *   (UTF-8).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Markdown`.
 * @property {boolean} [allowImages] Show pictures with an http(s) address or an embedded
 *   png, jpeg, gif or webp. Off by default, so a file cannot make the viewer fetch anything:
 *   pictures show as their alt text.
 * @property {{ line: number, matched: string, before?: string, after?: string }} [target] A
 *   source line (from 1) to scroll to, and the words to mark in the block that holds it.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link to
 *   another page is clicked. When given, the link is not opened. Without it, links open in a new
 *   window.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found in
 *   what is shown (`null`: there is no target).
 * @property {(info: { blockCount: number }) => void} [onReady] Called when the text is shown.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded.
 */

/**
 * @param {HTMLElement} container
 * @param {Element} element
 * @param {number} offset Where in the view to put the element, in pixels from the top.
 */
function scrollInto(container, element, offset) {
  const inside = element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTop += inside - offset;
}

/** @param {string} value */
const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Rendered Markdown of any size. The text is parsed once; only the groups of blocks near the screen
 * are drawn, so a very long file costs no more to scroll than a short one. It can land on a source
 * line and mark words in the block that holds it.
 *
 * @param {MarkdownViewerProps} props
 */
export function MarkdownViewer({
  source,
  fetcher,
  theme,
  label = 'Markdown',
  allowImages = false,
  target,
  onNavigate,
  onMarked,
  onReady,
  onError,
}) {
  const { status, text, error } = useText(source, fetcher);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [root, setRoot] = useState(/** @type {HTMLDivElement | null} */ (null));
  const attach = useCallback((/** @type {HTMLDivElement | null} */ element) => {
    rootRef.current = element;
    setRoot(element);
  }, []);
  const [parsed, setParsed] = useState(
    /** @type {{ text: string, blocks: import('./blocks.js').Block[] } | null} */ (null),
  );
  const md = useMemo(() => createMarkdown({ allowImages }), [allowImages]);

  // Parse after the first paint, so a large file shows "Rendering" rather than a frozen window.
  useEffect(() => {
    if (text === null) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      const blocks = blocksOf(md, text);
      if (!cancelled) setParsed({ text, blocks });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [md, text]);

  const blocks = parsed && parsed.text === text ? parsed.blocks : null;
  const groups = useMemo(() => {
    if (!blocks) return [];
    const out = [];
    for (let i = 0; i < blocks.length; i += GROUP) {
      out.push({ first: i, blocks: blocks.slice(i, i + GROUP) });
    }
    return out;
  }, [blocks]);
  const anchors = useMemo(() => (blocks ? anchorsOf(blocks) : new Map()), [blocks]);

  const line = target?.line;
  const matched = target?.matched;
  const before = target?.before;
  const after = target?.after;
  const targetBlock = blocks && line !== undefined ? blockAt(blocks, line - 1) : null;
  const targetGroup = targetBlock === null ? null : Math.floor(targetBlock / GROUP);
  const marked = useLatest(onMarked);

  // When the group with the target is drawn: mark the words and bring them (or the block) into view.
  const handledTarget = useRef(/** @type {string | null} */ (null));
  const [jump, setJump] = useState(
    /** @type {{ id: string, group: number, n: number } | null} */ (null),
  );
  const handledJump = useRef(0);
  const onDrawn = useCallback(
    (/** @type {HTMLElement} */ frame, /** @type {number} */ index) => {
      const container = rootRef.current;
      if (!container || !blocks) return;
      if (index === targetGroup && targetBlock !== null) {
        const at = `${line}:${matched}:${before ?? ''}:${after ?? ''}:${blocks.length}`;
        if (handledTarget.current !== at) {
          handledTarget.current = at;
          clearMarks(container);
          const block = frame.querySelector(`[data-block="${targetBlock}"]`);
          if (block instanceof HTMLElement) {
            const mark = matched ? markIn(block, { matched, before, after }) : null;
            marked.current?.(mark !== null);
            scrollInto(container, mark ?? block, container.clientHeight / 3);
          }
        }
      }
      if (jump && index === jump.group && handledJump.current !== jump.n) {
        handledJump.current = jump.n;
        const element = frame.querySelector(`[id="${jump.id.replaceAll('"', '\\"')}"]`);
        if (element) scrollInto(container, element, 16);
      }
    },
    [blocks, targetGroup, targetBlock, line, matched, before, after, jump, marked],
  );

  useEffect(() => {
    if (!target) marked.current?.(null);
  }, [target, marked]);

  // A link inside the page (a footnote) scrolls to its place, drawing it first when it is far off.
  const jumpTo = useCallback(
    (/** @type {string} */ id) => {
      const container = rootRef.current;
      if (!container) return;
      const element = container.querySelector(`[id="${id.replaceAll('"', '\\"')}"]`);
      if (element) {
        scrollInto(container, element, 16);
        return;
      }
      const block = anchors.get(id);
      if (block !== undefined) {
        setJump((current) => ({ id, group: Math.floor(block / GROUP), n: (current?.n ?? 0) + 1 }));
      }
    },
    [anchors],
  );

  const navigate = useLatest(onNavigate);
  useEffect(() => {
    if (!root) return undefined;
    const onClick = (/** @type {MouseEvent} */ event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (href.startsWith('#')) {
        event.preventDefault();
        jumpTo(decode(href.slice(1)));
      } else if (navigate.current) {
        event.preventDefault();
        navigate.current(href, event);
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [root, jumpTo, navigate]);

  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  useEffect(() => {
    if (blocks) ready.current?.({ blockCount: blocks.length });
  }, [blocks, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  return (
    <div
      ref={attach}
      role="region"
      aria-label={label}
      aria-busy={status === 'loading' || (status === 'ready' && !blocks)}
      className={styles.root}
      style={themeVars(theme)}
      // A scrollable region must take focus so the keyboard can scroll it.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      {status === 'loading' && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className={styles.message}>
          The Markdown could not be loaded: {error?.message}
        </p>
      )}
      {status === 'ready' && !blocks && (
        <p role="status" className={styles.message}>
          Rendering…
        </p>
      )}
      {blocks && (
        <div className={styles.content}>
          {groups.map((g, index) => (
            <Group
              key={g.first}
              index={index}
              first={g.first}
              blocks={g.blocks}
              md={md}
              root={root}
              wanted={index === targetGroup || (jump !== null && index === jump.group)}
              onDrawn={onDrawn}
            />
          ))}
        </div>
      )}
    </div>
  );
}
