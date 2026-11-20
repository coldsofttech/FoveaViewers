import {
  applyTheme,
  clearMarks,
  createShell,
  loadText,
  markIn,
  scoreMatch,
  squash,
} from '@coldsofttech/fovea-viewers/core/vanilla';
import { parseFeed } from '../parseFeed.js';
import { sanitizeToFragment } from '../sanitize.js';
import styles from '../FeedViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../parseFeed.js').Feed} Feed
 * @typedef {import('../parseFeed.js').FeedEntry} FeedEntry
 */

/**
 * @typedef {object} FeedViewerProps
 * @property {ViewerSource} source The feed: a URL, a Blob or File, or an ArrayBuffer (UTF-8). RSS
 *   2.0, RSS 1.0 and Atom are read.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Feed`.
 * @property {boolean} [richText] Show the HTML of entries (cleaned) rather than their text. Off by
 *   default.
 * @property {boolean} [allowImages] Show pictures: the feed's logo, each entry's picture, and the
 *   pictures inside entries when `richText` is on. Off by default, so nothing is loaded from the web.
 * @property {number} [pageSize] How many entries are shown at first, and added by each press of
 *   the Show more button. Defaults to 50.
 * @property {{ matched: string, before?: string, after?: string }} [target] Words to find: the
 *   entry that holds them is outlined and scrolled to, and the words are marked.
 * @property {(entry: number | null) => void} [onLocated] Called with the number (from 1) of the
 *   entry the target is in, or `null` when it is in none (or there is no target).
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link is
 *   clicked, instead of opening it. Without it, links open in a new window.
 * @property {(info: { entryCount: number, format: 'rss' | 'rdf' | 'atom' }) => void} [onReady]
 *   Called when the feed is shown.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/** Only a web address is made a link or a picture (a feed can say anything). */
const isWeb = (/** @type {string | null} */ value) => /^https?:\/\//i.test(value ?? '');

const FORMATS = { rss: 'RSS', rdf: 'RSS 1.0', atom: 'Atom' };

/**
 * A date for people, in the reader's own language and time zone.
 *
 * @param {string | null} iso
 * @param {string | null} raw
 * @returns {string}
 */
function formatDate(iso, raw) {
  if (!iso) return raw ?? '';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return raw ?? iso;
  }
}

/**
 * A size in bytes for people.
 *
 * @param {number | null} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The text of an entry that a search looks in.
 *
 * @param {FeedEntry} entry
 * @returns {string}
 */
const searchText = (entry) =>
  squash([entry.title, entry.author, entry.categories.join(' '), entry.text].join(' '));

/**
 * The file name at the end of an address, for naming an attachment.
 *
 * @param {string} href
 * @returns {string}
 */
function fileName(href) {
  const path = href.split(/[?#]/)[0];
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) || href;
}

/**
 * A reader for an RSS or Atom feed, drawn into a container: its title and details, then each entry
 * as a card with its title, author, date, categories, text, attachments and link. Entries are shown
 * a page at a time.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {FeedViewerProps} props
 * @returns {ViewerController}
 */
export function createFeedViewer(container, props) {
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
  let loadError = null;
  /** @type {Feed | null} */
  let feed = null;
  /** @type {Error | null} */
  let parseError = null;
  /** More entries the reader has asked for, for the feed they belong to. */
  let pages = 0;

  /** @type {{ feed: Feed | null, hay: string[] }} */
  let haystacks = { feed: null, hay: [] };
  /** @type {HTMLElement[]} */
  let messages = [];
  /** @type {{ feed: Feed, allowImages: boolean, element: HTMLElement } | null} */
  let head = null;
  /** @type {{ feed: Feed, richText: boolean, allowImages: boolean, list: HTMLElement, empty: HTMLElement | null, drawn: number } | null} */
  let entries = null;
  /** @type {HTMLElement | null} */
  let more = null;
  /** @type {Feed | null} */
  let reportedFeed = null;
  /** @type {Error | null} */
  let failed = null;
  /** @type {number | null | undefined} */
  let reportedLocated;
  /** @type {Feed | null} */
  let reportedLocatedFeed = null;

  /**
   * A web address as a link that opens in a new window; anything else is just its text.
   *
   * @param {string} href
   * @param {string} label
   */
  const link = (href, label) =>
    isWeb(href) ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label) : label;

  /** The entry the target is in: the one where the words and their surroundings agree best. */
  function locate() {
    const { target } = shell.props;
    const needle = squash(target?.matched);
    if (!feed || !needle) return null;
    if (haystacks.feed !== feed) haystacks = { feed, hay: feed.entries.map(searchText) };
    let best = null;
    let bestScore = -1;
    haystacks.hay.forEach((hay, index) => {
      const { at, score } = scoreMatch(hay, needle, squash(target?.before), squash(target?.after));
      if (at !== -1 && score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    return best;
  }

  /** @param {Feed} current */
  function buildHead(current) {
    const { allowImages = false } = shell.props;
    const facts = [
      h('li', { class: styles.fact }, FORMATS[current.format]),
      current.language ? h('li', { class: styles.fact }, current.language) : null,
      current.updated
        ? h(
            'li',
            { class: styles.fact },
            'Updated ',
            h(
              'time',
              { datetime: current.updatedIso },
              formatDate(current.updatedIso, current.updated),
            ),
          )
        : null,
      h(
        'li',
        { class: styles.fact },
        `${current.entries.length} ${current.entries.length === 1 ? 'entry' : 'entries'}`,
      ),
      current.generator ? h('li', { class: styles.fact }, current.generator) : null,
      current.copyright ? h('li', { class: styles.fact }, current.copyright) : null,
    ];
    return h(
      'div',
      { class: styles.head },
      allowImages && isWeb(current.image)
        ? h('img', {
            class: styles.logo,
            src: current.image,
            alt: '',
            loading: 'lazy',
            referrerpolicy: 'no-referrer',
          })
        : null,
      h('h2', { class: styles.title }, current.title || 'Untitled feed'),
      current.description ? h('p', { class: styles.description }, current.description) : null,
      current.link && isWeb(current.link)
        ? h('span', null, link(current.link, current.link))
        : null,
      h('ul', { class: styles.facts, 'aria-label': 'About this feed' }, facts),
    );
  }

  /**
   * @param {FeedEntry} entry
   * @param {number} index
   * @param {{ richText: boolean, allowImages: boolean }} options
   */
  function buildEntry(entry, index, { richText, allowImages }) {
    let body = null;
    if (richText && entry.html !== null) {
      body = h('div', { class: styles.rich });
      // The cleaned nodes are made in a separate document, so move them into this one first.
      body.append(root.ownerDocument.adoptNode(sanitizeToFragment(entry.html, allowImages)));
    } else if (entry.text) {
      body = h('p', { class: styles.text }, entry.text);
    }
    return h(
      'li',
      null,
      h(
        'article',
        { class: styles.entry, 'data-entry': index },
        h('h3', { class: styles.entryTitle }, link(entry.link, entry.title || 'Untitled entry')),
        h(
          'div',
          { class: styles.meta },
          entry.author ? h('span', null, entry.author) : null,
          entry.published
            ? h(
                'time',
                { datetime: entry.publishedIso },
                formatDate(entry.publishedIso, entry.published),
              )
            : null,
        ),
        entry.categories.length > 0
          ? h(
              'ul',
              { class: styles.categories, 'aria-label': 'Categories' },
              entry.categories.map((category) => h('li', { class: styles.category }, category)),
            )
          : null,
        allowImages && isWeb(entry.image)
          ? h('img', {
              class: styles.picture,
              src: entry.image,
              alt: '',
              loading: 'lazy',
              referrerpolicy: 'no-referrer',
            })
          : null,
        body,
        entry.enclosures.length > 0
          ? h(
              'ul',
              { class: styles.attachments, 'aria-label': 'Attachments' },
              entry.enclosures.map((file) => {
                const facts = [file.type, formatSize(file.length)].filter(Boolean);
                return h(
                  'li',
                  null,
                  link(file.href, fileName(file.href)),
                  facts.length > 0 ? ` (${facts.join(', ')})` : null,
                );
              }),
            )
          : null,
      ),
    );
  }

  function render() {
    const error = loadError ?? parseError;
    root.setAttribute('aria-label', shell.props.label ?? 'Feed');
    root.setAttribute('aria-busy', String(status === 'loading'));

    for (const message of messages) message.remove();
    messages = [];
    if (status === 'loading')
      messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (error) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The feed could not be read: ${error.message}`,
        ),
      );
    }
    root.prepend(...messages);

    const located = locate();
    const { pageSize = 50, richText = false, allowImages = false } = shell.props;
    const total = feed ? feed.entries.length : 0;
    // How many entries are shown: a page, and one more for each press of the button, and enough to
    // reach the entry that holds the target.
    const visible = Math.min(
      total,
      Math.max(pageSize * (pages + 1), located === null ? 0 : located + 1),
    );

    if (!feed) {
      head?.element.remove();
      head = null;
      entries?.list.remove();
      entries?.empty?.remove();
      entries = null;
      more?.remove();
      more = null;
    } else {
      if (!head || head.feed !== feed || head.allowImages !== allowImages) {
        head?.element.remove();
        head = { feed, allowImages, element: buildHead(feed) };
        root.append(head.element);
      }
      if (
        !entries ||
        entries.feed !== feed ||
        entries.richText !== richText ||
        entries.allowImages !== allowImages
      ) {
        entries?.list.remove();
        entries?.empty?.remove();
        const list = h('ol', { class: styles.entries });
        const empty =
          total === 0 ? h('p', { class: styles.message }, 'This feed has no entries.') : null;
        entries = { feed, richText, allowImages, list, empty, drawn: 0 };
        // The "no entries" line sits before the (empty) list, as it did.
        if (empty) root.append(empty);
        root.append(list);
      }
      // New cards go on the end and the cards already there are left alone, so what a host has
      // done to them (marks) stays.
      while (entries.drawn > visible) {
        entries.list.lastElementChild?.remove();
        entries.drawn--;
      }
      while (entries.drawn < visible) {
        entries.list.append(
          buildEntry(feed.entries[entries.drawn], entries.drawn, { richText, allowImages }),
        );
        entries.drawn++;
      }
      for (const card of entries.list.querySelectorAll('article')) {
        if (Number(card.getAttribute('data-entry')) === located)
          card.setAttribute('aria-current', 'true');
        else card.removeAttribute('aria-current');
      }

      if (total > pageSize) {
        more?.remove();
        more = h(
          'div',
          { class: styles.more },
          h('span', null, `Showing ${visible} of ${total} entries`),
          visible < total
            ? h(
                'button',
                {
                  type: 'button',
                  onclick: () => {
                    pages++;
                    render();
                  },
                },
                `Show ${Math.min(pageSize, total - visible)} more`,
              )
            : null,
        );
        root.append(more);
      } else {
        more?.remove();
        more = null;
      }
    }

    // Mark the words in the entry that holds them and bring it into view.
    clearMarks(root);
    const { target } = shell.props;
    if (feed && located !== null && target?.matched !== undefined) {
      const card = root.querySelector(`[data-entry="${located}"]`);
      if (card instanceof HTMLElement) {
        markIn(card, { matched: target.matched, before: target.before, after: target.after });
        card.scrollIntoView?.({ block: 'center' });
      }
    }

    if (feed && (feed !== reportedLocatedFeed || located !== reportedLocated)) {
      shell.emit('onLocated', located === null ? null : located + 1);
    }
    reportedLocated = located;
    reportedLocatedFeed = feed;
    if (feed && feed !== reportedFeed) {
      shell.emit('onReady', { entryCount: feed.entries.length, format: feed.format });
    }
    reportedFeed = feed;
    if (error && error !== failed) shell.emit('onError', error);
    failed = error;
  }

  function parse() {
    feed = null;
    parseError = null;
    pages = 0;
    if (text === null) return;
    try {
      feed = parseFeed(text);
    } catch (cause) {
      parseError = cause instanceof Error ? cause : new Error(String(cause));
    }
  }

  function reload() {
    status = 'loading';
    text = null;
    loadError = null;
    parse();
    render();
    shell.load((signal) => loadText(shell.props.source, { fetcher: shell.props.fetcher, signal }), {
      onResult(loaded) {
        status = 'ready';
        text = loaded;
        parse();
        render();
      },
      onError(error) {
        status = 'error';
        loadError = error;
        render();
      },
    });
  }

  // A link goes to the host's handler when there is one, and otherwise opens in a new window.
  root.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    const href = anchor?.getAttribute('href') ?? '';
    if (anchor && !href.startsWith('#') && shell.props.onNavigate) {
      event.preventDefault();
      shell.emit('onNavigate', href, event);
    }
  });

  applyTheme(root, props.theme);
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else render();
  });
  return shell.api;
}
