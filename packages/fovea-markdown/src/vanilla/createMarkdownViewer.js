import {
  applyTheme,
  clearMarks,
  createShell,
  loadText,
  markIn,
} from '@coldsofttech/fovea-viewers/core/vanilla';
import { anchorsOf, blockAt, blocksOf, createMarkdown, render as renderBlock } from '../blocks.js';
import { sanitizeToFragment } from '../sanitize.js';
import styles from '../MarkdownViewer.module.css';

/** Blocks are drawn (and dropped) a group at a time: a file of any length is a list of groups. */
export const GROUP = 40;

const LINE_ESTIMATE = 22;
const BLOCK_ESTIMATE = 14;
const NEAR = '1500px 0px';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../blocks.js').Block} Block
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
 * @param {Block[]} blocks
 * @returns {number} A guess at the height of the blocks, in pixels, from the lines they cover.
 */
const estimate = (blocks) =>
  blocks.reduce((sum, b) => sum + Math.max(1, b.end - b.start) * LINE_ESTIMATE + BLOCK_ESTIMATE, 0);

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

/** @param {string} id */
const byId = (id) => `[id="${id.replaceAll('"', '\\"')}"]`;

/**
 * Rendered Markdown of any size, drawn into a container. The text is parsed once; only the groups
 * of blocks near the screen are drawn, so a very long file costs no more to scroll than a short
 * one. It can land on a source line and mark words in the block that holds it.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {MarkdownViewerProps} props
 * @returns {ViewerController}
 */
export function createMarkdownViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;
  root.setAttribute('role', 'region');
  // A scrollable region must take focus so the keyboard can scroll it.
  root.setAttribute('tabindex', '0');

  /** @type {'loading' | 'ready' | 'error'} */
  let status = 'loading';
  /** @type {string | null} */
  let text = null;
  /** @type {Error | null} */
  let error = null;
  /** @type {{ allowImages: boolean, md: ReturnType<typeof createMarkdown> } | null} */
  let mdCache = null;
  /** @type {{ text: string, blocks: Block[] } | null} */
  let parsed = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let parseTimer;
  /** @type {Map<string, number>} */
  let anchors = new Map();
  /** @type {{ id: string, group: number, n: number } | null} */
  let jump = null;
  let handledTarget = '';
  let handledJump = 0;
  /** @type {HTMLElement | null} */
  let message = null;
  /** @type {HTMLElement | null} */
  let content = null;
  /** @type {Block[] | null} */
  let groupedFor = null;
  /** @type {Array<{ index: number, first: number, blocks: Block[], frame: HTMLElement, near: boolean, shown: { blocks: Block[], md: unknown } | null }>} */
  let groups = [];
  /** @type {IntersectionObserver | null} */
  let observer = null;
  /** @type {Block[] | null} */
  let reportedBlocks = null;
  /** @type {Error | null} */
  let failed = null;
  let reportedMarkedNull = false;

  const getMd = () => {
    const allowImages = shell.props.allowImages ?? false;
    if (!mdCache || mdCache.allowImages !== allowImages) {
      mdCache = { allowImages, md: createMarkdown({ allowImages }) };
    }
    return mdCache.md;
  };

  const blocks = () => (parsed && parsed.text === text ? parsed.blocks : null);

  function targetPlace() {
    const list = blocks();
    const line = shell.props.target?.line;
    const block = list && line !== undefined ? blockAt(list, line - 1) : null;
    return { block, group: block === null ? null : Math.floor(block / GROUP) };
  }

  /** Draws a group when it is near the screen or wanted, and otherwise leaves a space its height. */
  function syncGroup(/** @type {(typeof groups)[number]} */ g) {
    const wanted = g.index === targetPlace().group || (jump !== null && g.index === jump.group);
    const md = getMd();
    if (g.near || wanted) {
      // Already drawn from these blocks: leave the nodes alone.
      if (g.shown?.blocks === g.blocks && g.shown.md === md && g.frame.firstChild) return;
      g.shown = { blocks: g.blocks, md };
      const html = g.blocks
        .map((b, i) => `<div data-block="${g.first + i}">${renderBlock(md, b)}</div>`)
        .join('');
      g.frame.style.height = '';
      // The cleaned nodes are made in a separate document, so move them into this one first.
      g.frame.replaceChildren(root.ownerDocument.adoptNode(sanitizeToFragment(html)));
    } else {
      g.shown = null;
      g.frame.style.height = `${g.frame.offsetHeight || estimate(g.blocks)}px`;
      g.frame.replaceChildren();
    }
  }

  /** When the group with the target is drawn: mark the words and bring them (or the block) into view. */
  function onDrawn(/** @type {HTMLElement} */ frame, /** @type {number} */ index) {
    const list = blocks();
    if (!list) return;
    const { target } = shell.props;
    const { block: targetBlock, group: targetGroup } = targetPlace();
    if (index === targetGroup && targetBlock !== null && target) {
      const at = `${target.line}:${target.matched}:${target.before ?? ''}:${target.after ?? ''}:${list.length}`;
      if (handledTarget !== at) {
        handledTarget = at;
        clearMarks(root);
        const block = frame.querySelector(`[data-block="${targetBlock}"]`);
        if (block instanceof HTMLElement) {
          const mark = target.matched
            ? markIn(block, { matched: target.matched, before: target.before, after: target.after })
            : null;
          shell.emit('onMarked', mark !== null);
          scrollInto(root, mark ?? block, root.clientHeight / 3);
        }
      }
    }
    if (jump && index === jump.group && handledJump !== jump.n) {
      handledJump = jump.n;
      const element = frame.querySelector(byId(jump.id));
      if (element) scrollInto(root, element, 16);
    }
  }

  function buildGroups(/** @type {Block[]} */ list) {
    observer?.disconnect();
    observer = null;
    groups = [];
    content?.remove();
    content = h('div', { class: styles.content });
    root.append(content);
    // Without IntersectionObserver (old browsers, tests), everything is drawn.
    const watching = typeof IntersectionObserver !== 'undefined';
    if (watching) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const g = groups.find((candidate) => candidate.frame === entry.target);
            if (!g || g.near === entry.isIntersecting) continue;
            g.near = entry.isIntersecting;
            syncGroup(g);
            if (g.frame.firstChild) onDrawn(g.frame, g.index);
          }
        },
        { root, rootMargin: NEAR },
      );
    }
    for (let first = 0, index = 0; first < list.length; first += GROUP, index++) {
      const frame = h('div', { 'data-group': index });
      const g = {
        index,
        first,
        blocks: list.slice(first, first + GROUP),
        frame,
        near: !watching,
        shown: null,
      };
      groups.push(g);
      content.append(frame);
      observer?.observe(frame);
    }
    groupedFor = list;
    anchors = anchorsOf(list);
  }

  function render() {
    const list = blocks();
    root.setAttribute('aria-label', shell.props.label ?? 'Markdown');
    root.setAttribute('aria-busy', String(status === 'loading' || (status === 'ready' && !list)));

    message?.remove();
    message = null;
    if (status === 'loading')
      message = h('p', { role: 'status', class: styles.message }, 'Loading…');
    else if (status === 'error') {
      message = h(
        'p',
        { role: 'alert', class: styles.message },
        `The Markdown could not be loaded: ${error?.message ?? ''}`,
      );
    } else if (status === 'ready' && !list)
      message = h('p', { role: 'status', class: styles.message }, 'Rendering…');
    if (message) root.prepend(message);

    if (list) {
      if (groupedFor !== list) buildGroups(list);
      for (const g of groups) syncGroup(g);
      const { group: targetGroup } = targetPlace();
      for (const g of groups) {
        const wanted = g.index === targetGroup || (jump !== null && g.index === jump.group);
        if (wanted && g.frame.firstChild) onDrawn(g.frame, g.index);
      }
    } else if (content) {
      observer?.disconnect();
      observer = null;
      content.remove();
      content = null;
      groups = [];
      groupedFor = null;
    }

    if (!shell.props.target) {
      if (!reportedMarkedNull) shell.emit('onMarked', null);
      reportedMarkedNull = true;
    } else {
      reportedMarkedNull = false;
    }
    if (list && list !== reportedBlocks) shell.emit('onReady', { blockCount: list.length });
    reportedBlocks = list;
    if (error && error !== failed) shell.emit('onError', error);
    failed = error;
  }

  /** Parse after the first paint, so a large file shows "Rendering" rather than a frozen window. */
  function parse() {
    clearTimeout(parseTimer);
    if (text === null) return;
    const current = text;
    const md = getMd();
    parseTimer = setTimeout(() => {
      parsed = { text: current, blocks: blocksOf(md, current) };
      render();
    }, 0);
  }

  /** A link inside the page (a footnote) scrolls to its place, drawing it first when it is far off. */
  function jumpTo(/** @type {string} */ id) {
    const element = root.querySelector(byId(id));
    if (element) {
      scrollInto(root, element, 16);
      return;
    }
    const block = anchors.get(id);
    if (block !== undefined) {
      jump = { id, group: Math.floor(block / GROUP), n: (jump?.n ?? 0) + 1 };
      render();
    }
  }

  root.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      event.preventDefault();
      jumpTo(decode(href.slice(1)));
    } else if (shell.props.onNavigate) {
      event.preventDefault();
      shell.emit('onNavigate', href, event);
    }
  });

  function reload() {
    status = 'loading';
    text = null;
    error = null;
    parsed = null;
    clearTimeout(parseTimer);
    render();
    shell.load((signal) => loadText(shell.props.source, { fetcher: shell.props.fetcher, signal }), {
      onResult(loaded) {
        status = 'ready';
        text = loaded;
        render();
        parse();
      },
      onError(failure) {
        status = 'error';
        error = failure;
        render();
      },
    });
  }

  shell.cleanup(() => {
    clearTimeout(parseTimer);
    observer?.disconnect();
  });
  applyTheme(root, props.theme);
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('source') || changed.includes('fetcher')) {
      reload();
      return;
    }
    if (changed.includes('allowImages')) {
      render();
      parse();
      return;
    }
    render();
  });
  return shell.api;
}
