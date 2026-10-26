import { htmlToText, looksLikeHtml, tidy } from './text.js';

const ATOM = 'http://www.w3.org/2005/Atom';

/**
 * @typedef {object} Enclosure
 * @property {string} href The address of the file.
 * @property {string} type Its MIME type, or an empty string.
 * @property {number | null} length Its size in bytes, when the feed says.
 */

/**
 * @typedef {object} FeedEntry
 * @property {string} title
 * @property {string} author
 * @property {string | null} published The date as the feed wrote it.
 * @property {string | null} publishedIso The date as an ISO string, when it could be read.
 * @property {string[]} categories
 * @property {string} link The entry's address.
 * @property {string} text The body as plain text.
 * @property {string | null} html The body as HTML, when the feed gave it as HTML.
 * @property {string} image The address of a picture for the entry, or an empty string.
 * @property {Enclosure[]} enclosures
 */

/**
 * @typedef {object} Feed
 * @property {'rss' | 'rdf' | 'atom'} format
 * @property {string} title
 * @property {string} description
 * @property {string} link The address of the site.
 * @property {string} language
 * @property {string | null} updated The date as the feed wrote it.
 * @property {string | null} updatedIso
 * @property {string} generator
 * @property {string} copyright
 * @property {string} image The address of the feed's logo, or an empty string.
 * @property {FeedEntry[]} entries
 */

/** The child elements of an element with this local name, whatever their prefix. */
const named = (/** @type {Element} */ el, /** @type {string} */ name) =>
  Array.from(el.children).filter((child) => child.localName === name);
/** The first of them. */
const first = (/** @type {Element} */ el, /** @type {string} */ name) => named(el, name)[0] ?? null;
const isAtom = (/** @type {Element} */ el) => el.namespaceURI === ATOM;
/** The first child with this name that is not an Atom element (RSS puts `atom:link` beside `link`). */
const plain = (/** @type {Element} */ el, /** @type {string} */ name) =>
  named(el, name).find((child) => !isAtom(child)) ?? null;

/** @param {Element | null | undefined} el */
const textOf = (el) => (el?.textContent ?? '').trim();

/**
 * The text of a title or name, which may hold HTML.
 *
 * @param {string} value
 * @returns {string}
 */
const clean = (value) => (looksLikeHtml(value) ? htmlToText(value) : tidy(value));

/**
 * A date as an ISO string, or `null` when it cannot be read.
 *
 * @param {string | null} raw
 * @returns {string | null}
 */
function toIso(raw) {
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * The name of an RSS author: `me@x.com (Ada)` is Ada and `Ada <me@x.com>` is Ada. A bare address
 * is kept, as it is all there is.
 *
 * @param {string} value
 * @returns {string}
 */
function authorName(value) {
  const inBrackets = /\(([^)]+)\)/.exec(value);
  if (inBrackets) return inBrackets[1].trim();
  const beforeAddress = /^(.*?)\s*<[^>]+>$/.exec(value);
  return (beforeAddress ? beforeAddress[1] : value).trim();
}

/**
 * A number from an attribute, or `null`.
 *
 * @param {string | null} value
 * @returns {number | null}
 */
function sizeOf(value) {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * The body of an Atom text construct (`<content type="html">`): its text, and its HTML when it is.
 *
 * @param {Element} el
 * @returns {{ text: string, html: string | null }}
 */
function atomBody(el) {
  const type = (el.getAttribute('type') ?? 'text').toLowerCase();
  if (type === 'xhtml') {
    const html = new XMLSerializer().serializeToString(el).replace(/^<[^>]*>|<\/[^>]*>$/g, '');
    return { text: htmlToText(html), html };
  }
  const value = el.textContent ?? '';
  if (type === 'html') return { text: htmlToText(value), html: value };
  return { text: tidy(value), html: null };
}

/**
 * The body of an RSS item: HTML when it looks like HTML, text otherwise.
 *
 * @param {string} value
 * @returns {{ text: string, html: string | null }}
 */
function rssBody(value) {
  return looksLikeHtml(value)
    ? { text: htmlToText(value), html: value }
    : { text: tidy(value), html: null };
}

/**
 * The picture and attachments an RSS or Atom entry points to.
 *
 * @param {Element} item
 * @returns {{ image: string, enclosures: Enclosure[] }}
 */
function media(item) {
  let image = '';
  /** @type {Enclosure[]} */
  const enclosures = [];
  /** @param {string} href @param {string} type @param {number | null} length */
  const add = (href, type, length) => {
    if (!href) return;
    if (/^image\//i.test(type)) image ||= href;
    else enclosures.push({ href, type, length });
  };
  for (const child of Array.from(item.children)) {
    const name = child.localName;
    if (name === 'enclosure') {
      add(
        child.getAttribute('url') ?? '',
        child.getAttribute('type') ?? '',
        sizeOf(child.getAttribute('length')),
      );
    } else if (name === 'link' && child.getAttribute('rel') === 'enclosure') {
      add(
        child.getAttribute('href') ?? '',
        child.getAttribute('type') ?? '',
        sizeOf(child.getAttribute('length')),
      );
    } else if (name === 'thumbnail') {
      image ||= child.getAttribute('url') ?? '';
    } else if (name === 'image' && child.getAttribute('href')) {
      image ||= child.getAttribute('href') ?? '';
    } else if (name === 'content' && child.getAttribute('url')) {
      const type =
        child.getAttribute('type') ?? (child.getAttribute('medium') === 'image' ? 'image/*' : '');
      add(child.getAttribute('url') ?? '', type, sizeOf(child.getAttribute('fileSize')));
    }
  }
  return { image, enclosures };
}

/**
 * One RSS (2.0 or 1.0) item.
 *
 * @param {Element} item
 * @returns {FeedEntry}
 */
function rssEntry(item) {
  const encoded = named(item, 'encoded')[0];
  const body = rssBody(textOf(encoded) || textOf(first(item, 'description')));
  const published =
    textOf(first(item, 'pubDate')) ||
    textOf(first(item, 'date')) ||
    textOf(first(item, 'published')) ||
    null;
  const guid = first(item, 'guid');
  const link =
    textOf(plain(item, 'link')) ||
    (guid && guid.getAttribute('isPermaLink') !== 'false' && /^https?:/i.test(textOf(guid))
      ? textOf(guid)
      : '');
  const author = textOf(first(item, 'author')) || textOf(first(item, 'creator'));
  return {
    title: clean(textOf(first(item, 'title'))),
    author: authorName(author),
    published,
    publishedIso: toIso(published),
    categories: [...named(item, 'category'), ...named(item, 'subject')]
      .map((c) => clean(textOf(c)))
      .filter(Boolean),
    link,
    text: body.text,
    html: body.html,
    ...media(item),
  };
}

/**
 * One Atom entry.
 *
 * @param {Element} entry
 * @returns {FeedEntry}
 */
function atomEntry(entry) {
  const content = first(entry, 'content');
  const summary = first(entry, 'summary');
  const body = content ? atomBody(content) : summary ? atomBody(summary) : { text: '', html: null };
  const links = named(entry, 'link');
  const alternate = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate');
  const published = textOf(first(entry, 'published')) || textOf(first(entry, 'updated')) || null;
  const authors = named(entry, 'author').map((a) => textOf(first(a, 'name')) || textOf(a));
  return {
    title: clean(
      first(entry, 'title') ? atomBody(/** @type {Element} */ (first(entry, 'title'))).text : '',
    ),
    author: authors.filter(Boolean).join(', '),
    published,
    publishedIso: toIso(published),
    categories: named(entry, 'category')
      .map((c) => (c.getAttribute('label') || c.getAttribute('term') || '').trim())
      .filter(Boolean),
    link: alternate?.getAttribute('href') ?? '',
    text: body.text,
    html: body.html,
    ...media(entry),
  };
}

/**
 * Reads an RSS 2.0, RSS 1.0 (RDF) or Atom feed.
 *
 * @param {string} xml The feed's text.
 * @returns {Feed}
 * @throws {Error} When the text is not well-formed XML, or is not a feed.
 */
export function parseFeed(xml) {
  const doc = new DOMParser().parseFromString(
    xml.replace(/^FEFF/, '').trimStart(),
    'application/xml',
  );
  const root = doc.documentElement;
  if (
    !root ||
    root.localName === 'parsererror' ||
    doc.getElementsByTagName('parsererror').length > 0
  ) {
    throw new Error('It is not well-formed XML, so it cannot be read as a feed.');
  }

  if (root.localName === 'feed' && isAtom(root)) {
    const links = named(root, 'link');
    const alternate = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate');
    const updated = textOf(first(root, 'updated')) || null;
    const subtitle = first(root, 'subtitle');
    const title = first(root, 'title');
    return {
      format: 'atom',
      title: title ? clean(atomBody(title).text) : '',
      description: subtitle ? atomBody(subtitle).text : '',
      link: alternate?.getAttribute('href') ?? '',
      language: root.getAttribute('xml:lang') ?? '',
      updated,
      updatedIso: toIso(updated),
      generator: textOf(first(root, 'generator')),
      copyright: textOf(first(root, 'rights')),
      image: textOf(first(root, 'logo')) || textOf(first(root, 'icon')),
      entries: named(root, 'entry').map(atomEntry),
    };
  }

  const isRss = root.localName === 'rss';
  const isRdf = root.localName === 'RDF';
  if (!isRss && !isRdf) throw new Error('It is not an RSS or Atom feed.');
  const channel = first(root, 'channel');
  if (!channel) throw new Error('It is not an RSS or Atom feed: there is no channel.');
  // RSS 2.0 keeps its items in the channel, RSS 1.0 beside it.
  const items = named(isRdf ? root : channel, 'item');
  const updated =
    textOf(first(channel, 'lastBuildDate')) ||
    textOf(first(channel, 'pubDate')) ||
    textOf(first(channel, 'date')) ||
    null;
  const logo = first(channel, 'image') ?? first(root, 'image');
  return {
    format: isRdf ? 'rdf' : 'rss',
    title: clean(textOf(first(channel, 'title'))),
    description: clean(textOf(first(channel, 'description'))),
    link: textOf(plain(channel, 'link')),
    language: textOf(first(channel, 'language')) || textOf(first(channel, 'xml:lang')),
    updated,
    updatedIso: toIso(updated),
    generator: textOf(first(channel, 'generator')),
    copyright: textOf(first(channel, 'copyright')) || textOf(first(channel, 'rights')),
    image:
      (logo &&
        (textOf(first(logo, 'url')) || logo.getAttribute('href') || logo.getAttribute('url'))) ||
      '',
    entries: items.map(rssEntry),
  };
}
