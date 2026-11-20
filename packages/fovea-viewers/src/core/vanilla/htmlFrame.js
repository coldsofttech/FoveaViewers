import { prepareHtml } from '../prepareHtml.js';
import { clearMarks, markIn } from '../mark.js';
import { createShell } from './shell.js';

// Text a reader does not see in the page, so words are not looked for in it.
const HIDDEN = 'script,style,noscript,template,title,head';
const MARK_STYLE =
  'background: rgba(255, 196, 0, 0.5); color: inherit; border-radius: 2px; outline: 1px solid rgba(214, 140, 0, 0.8);';
// The only addresses a click on a link is allowed to follow.
const FOLLOW = /^(https?:|mailto:)/i;

// A page is drawn for a white background, whatever the theme around it.
const FRAME_STYLE =
  'display:block;width:100%;height:100%;border:0;background:#fff;color-scheme:light';

/**
 * @typedef {object} HtmlFrameProps
 * @property {string | null} html The page's markup, or `null` to show nothing yet.
 * @property {string} [base] The address the page came from, so its relative addresses resolve.
 *   Only used when pictures, styles or `links="viewer"` need it.
 * @property {boolean} [allowImages] Let http(s) pictures load. Off by default.
 * @property {boolean} [allowStyles] Let http(s) stylesheets and fonts load. Off by default.
 * @property {boolean} [allowScripts] Run the page's inline scripts, in a frame the viewer cannot
 *   reach into. Off by default.
 * @property {'none' | 'viewer' | 'window'} [links] What a click on a link does. Defaults to `none`.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link to another
 *   page is clicked, instead of doing what `links` says.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to scroll to and
 *   mark in what the page shows.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found.
 * @property {string} [label] The accessible name of the frame. Defaults to `Web page`.
 * @property {(info: { allowScripts: boolean }) => void} [onReady] Called when the page has loaded.
 * @property {string} [className] A class for the frame.
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
 * The frame fills its container.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {HtmlFrameProps} props
 * @returns {import('./shell.js').ViewerController}
 */
export function createHtmlFrame(container, props) {
  const shell = createShell(container, props, { required: [] });
  const { root } = shell;
  // The root takes no space of its own: the frame sits in the container as if it were its child.
  root.style.display = 'contents';
  const win = root.ownerDocument.defaultView ?? window;

  /** @type {HTMLIFrameElement | null} */
  let frame = null;
  let mode = '';
  /** @type {string | null} */
  let srcDoc = null;
  /** @type {{ srcDoc: string, load: number } | null} */
  let loaded = null;
  let handledTarget = '';

  /** The markup the frame shows, or null for nothing yet. */
  function compute() {
    const {
      html,
      base: address,
      allowImages = false,
      allowStyles = false,
      allowScripts = false,
      links = 'none',
    } = shell.props;
    if (html === null || html === undefined) return null;
    // Relative addresses only mean something when the page came from one.
    const wantsAddresses = allowImages || allowStyles || links === 'viewer';
    let base;
    if (typeof address === 'string' && wantsAddresses) {
      try {
        base = new URL(address, win.location.href).href;
      } catch {
        base = undefined;
      }
    }
    // With scripts on, a click on a link cannot be intercepted, so the links that must not work
    // are taken out of the page.
    const stripLinks = allowScripts && links !== 'viewer';
    return prepareHtml(html, { allowImages, allowStyles, allowScripts, stripLinks, base });
  }

  // The frame's page is a new document each time it loads, so it is set up each time.
  function onLoad() {
    if (srcDoc === null) return;
    const { allowScripts = false } = shell.props;
    const inside = allowScripts ? null : reach(frame);
    if (inside) {
      const { doc } = inside;
      doc.addEventListener('click', (/** @type {MouseEvent} */ event) => {
        const anchor = /** @type {any} */ (event.target)?.closest?.('a[href], area[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') ?? '';
        if (href.startsWith('#')) return; // scrolls inside the page
        const { links: how = 'none', onNavigate: navigate } = shell.props;
        if (navigate) {
          event.preventDefault();
          navigate(anchor.href, event);
        } else if (how === 'none' || !FOLLOW.test(anchor.href)) {
          event.preventDefault();
        } else if (how === 'window') {
          event.preventDefault();
          win.open(anchor.href, '_blank', 'noopener,noreferrer');
        }
      });
      doc.addEventListener('submit', (event) => event.preventDefault());
    } else if (!allowScripts) {
      return; // the frame has gone to another page
    }
    // Every load counts, not only the first: a frame can report a load of its empty first document
    // before the page, and the words are marked once the page itself is in.
    loaded = { srcDoc, load: (loaded?.load ?? 0) + 1 };
    shell.emit('onReady', { allowScripts });
    applyTarget(true);
  }

  /** Marks the words and scrolls them (not the window around the frame) into view. */
  function applyTarget(force = false) {
    const { target, allowScripts = false } = shell.props;
    const key = `${loaded?.load}:${target?.matched}:${target?.before}:${target?.after}`;
    if (!force && key === handledTarget) return;
    if (loaded?.srcDoc !== srcDoc) return;
    handledTarget = key;
    if (allowScripts) {
      // The page runs in a frame of its own, which the viewer cannot look into.
      shell.emit('onMarked', target === undefined ? null : false);
      return;
    }
    const inside = reach(frame);
    if (!inside) return;
    const { doc, win: inner } = inside;
    clearMarks(doc.body);
    if (target === undefined) {
      shell.emit('onMarked', null);
      return;
    }
    const mark = markIn(
      doc.body,
      { matched: target.matched, before: target.before, after: target.after },
      { skip: HIDDEN, style: MARK_STYLE },
    );
    shell.emit('onMarked', mark !== null);
    if (mark) {
      const top = mark.getBoundingClientRect().top + inner.scrollY - inner.innerHeight / 3;
      inner.scrollTo(0, Math.max(0, top));
    }
  }

  function sync() {
    srcDoc = compute();
    if (srcDoc === null) {
      frame?.remove();
      frame = null;
      mode = '';
      return;
    }
    const wanted = shell.props.allowScripts ? 'scripts' : 'static';
    // A frame's sandbox is read when it loads, so a change of mode starts a new frame.
    if (!frame || mode !== wanted) {
      frame?.remove();
      mode = wanted;
      // Forms, popups and navigating the page around the frame are always off. Without scripts
      // the viewer reaches into the frame (to mark words and handle links), which needs
      // `allow-same-origin` and is safe only because no script can run there. With scripts the
      // frame must NOT have `allow-same-origin`: together they would let the page lift its own
      // sandbox. It then has an origin of its own, and the viewer cannot reach into it.
      frame = /** @type {HTMLIFrameElement} */ (
        shell.h('iframe', { sandbox: wanted === 'scripts' ? 'allow-scripts' : 'allow-same-origin' })
      );
      frame.style.cssText = FRAME_STYLE;
      frame.addEventListener('load', onLoad);
      root.append(frame);
    }
    frame.title = shell.props.label ?? 'Web page';
    frame.className = shell.props.className ?? '';
    if (frame.getAttribute('srcdoc') !== srcDoc) frame.setAttribute('srcdoc', srcDoc);
  }

  shell.onUpdate(() => {
    sync();
    applyTarget();
  });
  sync();
  return shell.api;
}
