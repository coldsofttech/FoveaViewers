# @coldsofttech/fovea-feed

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-feed)](https://www.npmjs.com/package/@coldsofttech/fovea-feed)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

An RSS and Atom feed reader for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens a feed from a URL, a `File` or `Blob`, or raw bytes.
- Reads RSS 2.0, RSS 1.0 and Atom.
- Shows the feed's title, description and details, then each entry as a card with its title, author, date, categories, text, attachments and link.
- Safe by default: entries are shown as plain text, nothing is loaded from the web, and links open in a new window without access to your page.
- Rich text, pictures and your own link handling are switched on by choice.
- Shows entries a page at a time, so a feed with thousands of entries opens at once.
- Finds words in the feed and outlines and marks them, for example to show a search result.
- Light and dark themes, your own colours, or the colours of the page it sits in.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-feed @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { FeedViewer } from '@coldsofttech/fovea-feed';
import '@coldsofttech/fovea-feed/style.css';

<div style={{ height: 500 }}>
  <FeedViewer source="https://example.com/feed.xml" theme="dark" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Props

| Prop          | Description                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `source`      | The feed: a URL string, a `File` or `Blob`, or an `ArrayBuffer`. Text is read as UTF-8.                           |
| `fetcher`     | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                  |
| `theme`       | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's colours.                             |
| `label`       | The accessible name. Defaults to `Feed`.                                                                          |
| `richText`    | Show the HTML of entries (cleaned) rather than their text. Off by default.                                        |
| `allowImages` | Show pictures: the feed's logo, each entry's picture and the pictures in rich text. Off by default.               |
| `pageSize`    | How many entries are shown at first, and added by each press of **Show more**. Defaults to 50.                    |
| `target`      | `{ matched, before?, after? }`: words to find. Their entry is outlined and scrolled to, and the words are marked. |
| `onLocated`   | Called with the number (from 1) of the entry the target is in, or `null` when it is in none.                      |
| `onNavigate`  | Optional `(href, event) => void`. When given, a click on a link calls it instead of opening the link.             |
| `onReady`     | Called with `{ entryCount, format }` once the feed is shown. `format` is `rss`, `rdf` or `atom`.                  |
| `onError`     | Called with an `Error` when the file cannot be loaded or is not a feed. The viewer also shows the message.        |

## What is shown

- **The feed:** title, description, a link to the site, and its format, language, last update, number of entries, generator and copyright when it gives them.
- **Each entry:** title (a link when the entry has an address), author, date in the reader's own language and time zone, categories, text, attachments.
- **Attachments** (podcast audio, files) are listed as links with their type and size. They are never played or loaded.

Entries are read from `<item>` (RSS) and `<entry>` (Atom). The text of an entry is its full content when the feed gives it (`content:encoded`, Atom `<content>`) and its summary otherwise.

## Examples

### Rich text and pictures

By default an entry's HTML is turned into plain text, so nothing in a feed can change your page or reach out to the web.

```jsx
<FeedViewer source={url} richText />
```

With `richText`, entries show their paragraphs, lists, bold text and links. Scripts, styles, forms, frames and media are always removed. Links open in a new window that cannot reach your page.

Pictures need their own switch, because each one is a request that tells the site who opened the feed:

```jsx
<FeedViewer source={url} richText allowImages />
```

Only `http` and `https` pictures (and pictures embedded in the feed) are shown, with no referrer sent.

### Long feeds

```jsx
<FeedViewer source={url} pageSize={20} />
```

The viewer shows the first 20 entries and a **Show 20 more** button, with a count of how many are shown. A search target on a later page shows every entry up to it.

### Show a search result

`matched` is the text found, and `before` and `after` help pick the right entry when the words appear in several.

```jsx
<FeedViewer
  source={url}
  target={{ before: 'Released', matched: 'version 2', after: 'today' }}
  onLocated={(entry) => console.log(entry === null ? 'Not in the feed' : `Entry ${entry}`)}
/>
```

Words are looked for in each entry's title, author, categories and text.

### Load a URL with a sign-in token

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<FeedViewer source="https://example.com/private.rss" fetcher={fetcher} />;
```

### Handle links yourself

```jsx
<FeedViewer source={url} onNavigate={(href) => router.open(href)} />
```

### Read a feed without showing it

```js
import { parseFeed } from '@coldsofttech/fovea-feed';

const feed = parseFeed(xmlText);
// { format, title, description, link, language, updated, entries: [{ title, author, link, text, ... }] }
```

`parseFeed` throws an `Error` when the text is not well-formed XML or is not a feed.

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so `.rss` and `.atom` files, and files served as `application/rss+xml` or `application/atom+xml`, open here. A feed called `feed.xml` is plain XML to the viewer, which opens it as code, so ask for this viewer:

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={url} type="feed" richText />;
```

## Good to know

- **Well-formed XML only:** a feed with mistakes, such as an unescaped `&` or an HTML entity like `&nbsp;` outside a `CDATA` section, cannot be read. The viewer says so.
- **Encoding:** text is read as UTF-8.
- **Dates:** a date the viewer cannot read is shown as the feed wrote it.
- **Not a news reader:** it shows the feed it is given. It does not refresh, follow links to full articles or remember what was read.
- **Memory:** the whole feed is read and parsed once.

## Accessibility

- The viewer is a labelled region that takes keyboard focus, so arrow keys, Page Up, Page Down, Home and End scroll it.
- The feed title is a heading and each entry title is a lower-level heading inside its own article, so screen readers can move between entries.
- Dates are marked up as dates, and categories and attachments are labelled lists.
- A loading message and any error are announced.
- Give each viewer a clear `label` when a page shows more than one.

## License

MIT
