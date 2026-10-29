import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearMarks,
  markIn,
  scoreMatch,
  squash,
  themeVars,
  useLatest,
  useText,
} from '@coldsofttech/fovea-viewers/core';
import { Body } from './Body.jsx';
import { parseFeed } from './parseFeed.js';
import styles from './FeedViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 * @typedef {import('./parseFeed.js').Feed} Feed
 * @typedef {import('./parseFeed.js').FeedEntry} FeedEntry
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
const isWeb = (/** @type {string} */ value) => /^https?:\/\//i.test(value);

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
 * A reader for an RSS or Atom feed: its title and details, then each entry as a card with its
 * title, author, date, categories, text, attachments and link. Entries are shown a page at a time.
 *
 * @param {FeedViewerProps} props
 */
export function FeedViewer({
  source,
  fetcher,
  theme,
  label = 'Feed',
  richText = false,
  allowImages = false,
  pageSize = 50,
  target,
  onLocated,
  onNavigate,
  onReady,
  onError,
}) {
  const { status, text, error: loadError } = useText(source, fetcher);
  const root = useRef(/** @type {HTMLDivElement | null} */ (null));

  const parsed = useMemo(() => {
    if (text === null) return null;
    try {
      return { feed: parseFeed(text), error: null };
    } catch (cause) {
      return { feed: null, error: cause instanceof Error ? cause : new Error(String(cause)) };
    }
  }, [text]);
  const feed = parsed?.feed ?? null;
  const error = loadError ?? parsed?.error ?? null;

  // The entry the target is in: the one where the words and their surroundings agree best.
  const matched = target?.matched;
  const before = target?.before;
  const after = target?.after;
  const haystacks = useMemo(() => (feed ? feed.entries.map(searchText) : []), [feed]);
  const located = useMemo(() => {
    const needle = squash(matched);
    if (!needle) return null;
    let best = null;
    let bestScore = -1;
    haystacks.forEach((hay, index) => {
      const { at, score } = scoreMatch(hay, needle, squash(before), squash(after));
      if (at !== -1 && score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    return best;
  }, [haystacks, matched, before, after]);

  // How many entries are shown: a page, and one more for each press of the button, and enough to
  // reach the entry that holds the target.
  const [more, setMore] = useState(
    /** @type {{ feed: Feed | null, pages: number }} */ ({ feed: null, pages: 0 }),
  );
  const total = feed ? feed.entries.length : 0;
  const pages = more.feed === feed ? more.pages : 0;
  const visible = Math.min(
    total,
    Math.max(pageSize * (pages + 1), located === null ? 0 : located + 1),
  );

  const located$ = useLatest(onLocated);
  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  useEffect(() => {
    if (feed) located$.current?.(located === null ? null : located + 1);
  }, [feed, located, located$]);
  useEffect(() => {
    if (feed) ready.current?.({ entryCount: feed.entries.length, format: feed.format });
  }, [feed, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  // Mark the words in the entry that holds them and bring it into view.
  useEffect(() => {
    const element = root.current;
    if (!element || !feed) return;
    clearMarks(element);
    if (located === null || matched === undefined) return;
    const card = element.querySelector(`[data-entry="${located}"]`);
    if (!(card instanceof HTMLElement)) return;
    markIn(card, { matched, before, after });
    card.scrollIntoView?.({ block: 'center' });
  }, [feed, located, matched, before, after, visible, richText, allowImages]);

  // A link goes to the host's handler when there is one, and otherwise opens in a new window.
  const navigate = useLatest(onNavigate);
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const onClick = (/** @type {MouseEvent} */ event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = anchor?.getAttribute('href') ?? '';
      if (anchor && !href.startsWith('#') && navigate.current) {
        event.preventDefault();
        navigate.current(anchor.getAttribute('href') ?? '', event);
      }
    };
    element.addEventListener('click', onClick);
    return () => element.removeEventListener('click', onClick);
  }, [navigate]);

  /** @param {string} href @param {import('react').ReactNode} children */
  const link = (href, children) =>
    isWeb(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      children
    );

  return (
    <div
      ref={root}
      role="region"
      aria-label={label}
      aria-busy={status === 'loading'}
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
      {error && (
        <p role="alert" className={styles.message}>
          The feed could not be read: {error.message}
        </p>
      )}
      {feed && (
        <>
          <div className={styles.head}>
            {allowImages && isWeb(feed.image) && (
              <img
                className={styles.logo}
                src={feed.image}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <h2 className={styles.title}>{feed.title || 'Untitled feed'}</h2>
            {feed.description && <p className={styles.description}>{feed.description}</p>}
            {feed.link && isWeb(feed.link) && <span>{link(feed.link, feed.link)}</span>}
            <ul className={styles.facts} aria-label="About this feed">
              <li className={styles.fact}>{FORMATS[feed.format]}</li>
              {feed.language && <li className={styles.fact}>{feed.language}</li>}
              {feed.updated && (
                <li className={styles.fact}>
                  Updated{' '}
                  <time dateTime={feed.updatedIso ?? undefined}>
                    {formatDate(feed.updatedIso, feed.updated)}
                  </time>
                </li>
              )}
              <li className={styles.fact}>
                {total} {total === 1 ? 'entry' : 'entries'}
              </li>
              {feed.generator && <li className={styles.fact}>{feed.generator}</li>}
              {feed.copyright && <li className={styles.fact}>{feed.copyright}</li>}
            </ul>
          </div>

          {total === 0 && <p className={styles.message}>This feed has no entries.</p>}
          <ol className={styles.entries}>
            {feed.entries.slice(0, visible).map((entry, index) => (
              <li key={index}>
                <article
                  className={styles.entry}
                  data-entry={index}
                  aria-current={index === located ? 'true' : undefined}
                >
                  <h3 className={styles.entryTitle}>
                    {link(entry.link, entry.title || 'Untitled entry')}
                  </h3>
                  <div className={styles.meta}>
                    {entry.author && <span>{entry.author}</span>}
                    {entry.published && (
                      <time dateTime={entry.publishedIso ?? undefined}>
                        {formatDate(entry.publishedIso, entry.published)}
                      </time>
                    )}
                  </div>
                  {entry.categories.length > 0 && (
                    <ul className={styles.categories} aria-label="Categories">
                      {entry.categories.map((category, i) => (
                        <li key={i} className={styles.category}>
                          {category}
                        </li>
                      ))}
                    </ul>
                  )}
                  {allowImages && isWeb(entry.image) && (
                    <img
                      className={styles.picture}
                      src={entry.image}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <Body
                    text={entry.text}
                    html={entry.html}
                    rich={richText}
                    allowImages={allowImages}
                  />
                  {entry.enclosures.length > 0 && (
                    <ul className={styles.attachments} aria-label="Attachments">
                      {entry.enclosures.map((file, i) => (
                        <li key={i}>
                          {link(file.href, fileName(file.href))}
                          {[file.type, formatSize(file.length)].filter(Boolean).length > 0 &&
                            ` (${[file.type, formatSize(file.length)].filter(Boolean).join(', ')})`}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            ))}
          </ol>
          {total > pageSize && (
            <div className={styles.more}>
              <span>
                Showing {visible} of {total} entries
              </span>
              {visible < total && (
                <button
                  type="button"
                  onClick={() => setMore({ feed, pages: pages + 1 })}
                >{`Show ${Math.min(pageSize, total - visible)} more`}</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
