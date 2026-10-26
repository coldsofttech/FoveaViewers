import { useEffect, useMemo, useRef, useState } from 'react';
import { clearMarks, markIn, useLatest, useText } from '@coldsofttech/fovea-viewers/core';
import { prepare } from './prepare.js';
import styles from './HtmlViewer.module.css';

// Text a reader does not see in the page, so words are not looked for in it.
const HIDDEN = 'script,style,noscript,template,title,head';
const MARK_STYLE =
  'background: rgba(255, 196, 0, 0.5); color: inherit; border-radius: 2px; outline: 1px solid rgba(214, 140, 0, 0.8);';
// The only addresses a click on a link is allowed to follow.
const FOLLOW = /^(https?:|mailto:)/i;

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} HtmlViewerProps
 * @property {ViewerSource} source The page: a URL, a Blob or File, or an ArrayBuffer (UTF-8). For a
 *   URL, the page's relative addresses (pictures, stylesheets, links) resolve against it.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {boolean} [allowImages] Let http(s) pictures load. Off by default, so only pictures
 *   embedded in the page show.
 * @property {boolean} [allowStyles] Let http(s) stylesheets and fonts load. Off by default, so
 *   only the page's own styles apply.
 * @property {boolean} [allowScripts] Run the page's inline scripts. Off by default. The page then
 *   runs in a frame of its own, with no network, and the viewer can no longer reach into it: words
 *   are not marked, `onNavigate` and `links="window"` do not work, and a link only works with
 *   `links="viewer"`.
 * @property {'none' | 'viewer' | 'window'} [links] What a click on a link does. `none` (the
 *   default) does nothing, `viewer` opens the page inside the viewer, `window` opens http(s) and
 *   mailto links in a new window. Links to a place in the same page always scroll.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link to another
 *   page is clicked, instead of doing what `links` says.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to scroll to and
 *   mark in what the page shows.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found in
 *   what the page shows (`null`: there is no target).
 * @property {string} [label] The accessible name. Defaults to `Web page`.
 * @property {(info: { allowScripts: boolean }) => void} [onReady] Called when the page has loaded.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded.
 */

/**
 * The document and window inside a frame, when they are ours to use: the frame has shown the page,
 * is of our own origin and has not gone to another address.
 *
 * @param {HTMLIFrameElement | null} frame
 * @returns {{ doc: Document, win: Window } | null}
 */
function reach(frame) {
  try {
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    return doc?.body && win ? { doc, win } : null;
  } catch {
    // The frame went to another address and is not ours to look into.
    return null;
  }
}

/**
 * A web page in a frame that lets nothing in unless the host allows it: no pictures, styles or
 * fonts from the web, no scripts, and links that do nothing. It can scroll to and mark some words.
 *
 * @param {HtmlViewerProps} props
 */
export function HtmlViewer({
  source,
  fetcher,
  allowImages = false,
  allowStyles = false,
  allowScripts = false,
  links = 'none',
  onNavigate,
  target,
  onMarked,
  label = 'Web page',
  onReady,
  onError,
}) {
  const { status, text, error } = useText(source, fetcher);
  const frame = useRef(/** @type {HTMLIFrameElement | null} */ (null));
  const [loaded, setLoaded] = useState(
    /** @type {{ srcDoc: string, load: number } | null} */ (null),
  );

  // Relative addresses only mean something when the page came from one.
  const wantsAddresses = allowImages || allowStyles || links === 'viewer';
  const base = useMemo(() => {
    if (typeof source !== 'string' || !wantsAddresses) return undefined;
    try {
      return new URL(source, window.location.href).href;
    } catch {
      return undefined;
    }
  }, [source, wantsAddresses]);
  // With scripts on, a click on a link cannot be intercepted, so the links that must not work are
  // taken out of the page.
  const stripLinks = allowScripts && links !== 'viewer';
  const srcDoc = useMemo(
    () =>
      text === null
        ? null
        : prepare(text, { allowImages, allowStyles, allowScripts, stripLinks, base }),
    [text, allowImages, allowStyles, allowScripts, stripLinks, base],
  );

  const clicks = useLatest({ links, onNavigate });
  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  const marked = useLatest(onMarked);

  // The frame's page is a new document each time it loads, so it is set up each time.
  const onLoad = () => {
    if (srcDoc === null) return;
    const inside = allowScripts ? null : reach(frame.current);
    if (inside) {
      const { doc } = inside;
      doc.addEventListener('click', (/** @type {MouseEvent} */ event) => {
        const anchor = /** @type {any} */ (event.target)?.closest?.('a[href], area[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') ?? '';
        if (href.startsWith('#')) return; // scrolls inside the page
        const { links: how, onNavigate: navigate } = clicks.current;
        if (navigate) {
          event.preventDefault();
          navigate(anchor.href, event);
        } else if (how === 'none' || !FOLLOW.test(anchor.href)) {
          event.preventDefault();
        } else if (how === 'window') {
          event.preventDefault();
          window.open(anchor.href, '_blank', 'noopener,noreferrer');
        }
      });
      doc.addEventListener('submit', (event) => event.preventDefault());
    } else if (!allowScripts) {
      return; // the frame has gone to another page
    }
    // Every load counts, not only the first: a frame can report a load of its empty first document
    // before the page, and the words are marked once the page itself is in.
    setLoaded((previous) => ({ srcDoc, load: (previous?.load ?? 0) + 1 }));
  };

  useEffect(() => {
    if (loaded) ready.current?.({ allowScripts });
  }, [loaded, allowScripts, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  // Mark the words and scroll them (not the window around the frame) into view.
  const matched = target?.matched;
  const before = target?.before;
  const after = target?.after;
  useEffect(() => {
    if (loaded?.srcDoc !== srcDoc) return;
    if (allowScripts) {
      // The page runs in a frame of its own, which the viewer cannot look into.
      marked.current?.(matched === undefined ? null : false);
      return;
    }
    const inside = reach(frame.current);
    if (!inside) return;
    const { doc, win } = inside;
    clearMarks(doc.body);
    if (matched === undefined) {
      marked.current?.(null);
      return;
    }
    const mark = markIn(doc.body, { matched, before, after }, { skip: HIDDEN, style: MARK_STYLE });
    marked.current?.(mark !== null);
    if (mark) {
      const top = mark.getBoundingClientRect().top + win.scrollY - win.innerHeight / 3;
      win.scrollTo(0, Math.max(0, top));
    }
  }, [loaded, srcDoc, allowScripts, matched, before, after, marked]);

  return (
    <div className={styles.root}>
      {status === 'loading' && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className={styles.message}>
          The page could not be loaded: {error?.message}
        </p>
      )}
      {srcDoc !== null && (
        <iframe
          // A frame's sandbox is read when it loads, so a change of mode starts a new frame.
          key={allowScripts ? 'scripts' : 'static'}
          ref={frame}
          title={label}
          className={styles.frame}
          // Forms, popups and navigating the page around the frame are always off. Without scripts
          // the viewer reaches into the frame (to mark words and handle links), which needs
          // `allow-same-origin` and is safe only because no script can run there. With scripts the
          // frame must NOT have `allow-same-origin`: together they would let the page lift its own
          // sandbox. It then has an origin of its own, and the viewer cannot reach into it.
          sandbox={allowScripts ? 'allow-scripts' : 'allow-same-origin'}
          srcDoc={srcDoc}
          onLoad={onLoad}
        />
      )}
    </div>
  );
}
