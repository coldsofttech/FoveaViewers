# @coldsofttech/fovea-html

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-html)](https://www.npmjs.com/package/@coldsofttech/fovea-html)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

An HTML page viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens a page from a URL, a `File` or `Blob`, or raw bytes.
- Safe by default: nothing is loaded from the web, no script runs, and links do nothing.
- You switch on what you want: pictures, styles and fonts, links, and scripts.
- Finds words in the page and marks them, for example to show a search result.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-html @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { HtmlViewer } from '@coldsofttech/fovea-html';
import '@coldsofttech/fovea-html/style.css';

<div style={{ height: 500 }}>
  <HtmlViewer source={file} label="Saved page" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

With no options, the page shows its text, layout and its own styles, plus any pictures that are embedded in the file. That is often not how it looked on the web, because most pages pull their styles and pictures from other addresses. Switch those on below.

## Props

| Prop           | Description                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `source`       | The page: a URL string, a `File` or `Blob`, or an `ArrayBuffer`. Text is read as UTF-8.                              |
| `fetcher`      | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                     |
| `allowImages`  | Let `http` and `https` pictures load. Off by default.                                                                |
| `allowStyles`  | Let `http` and `https` stylesheets and fonts load. Off by default.                                                   |
| `allowScripts` | Run the page's inline scripts. Off by default. See the limits below.                                                 |
| `links`        | What a click on a link does: `'none'` (the default), `'viewer'` or `'window'`.                                       |
| `onNavigate`   | Optional `(href, event) => void`. When given, a click on a link calls it instead of doing what `links` says.         |
| `target`       | `{ matched, before?, after? }`: words to scroll to and mark in what the page shows.                                  |
| `onMarked`     | Called with `true` when the target's words were marked, `false` when they are not in the page, `null` for no target. |
| `label`        | The accessible name of the frame. Defaults to `Web page`.                                                            |
| `onReady`      | Called with `{ allowScripts }` once the page has loaded.                                                             |
| `onError`      | Called with an `Error` when the file cannot be loaded. The viewer also shows the message.                            |

## What is on by default

Nothing that reaches out. The page is cleaned (scripts, event handlers, frames, objects and `<base>` are removed), shown in a locked frame, and given a Content-Security-Policy that stops it loading anything: no pictures, stylesheets or fonts from the web. A page cannot tell any website that it was opened. Forms cannot be submitted, popups cannot open, and the page cannot take over yours.

Each of these is a choice for you to make for pages you trust:

### Pictures, styles and fonts

```jsx
<HtmlViewer source={file} allowImages allowStyles />
```

Only `http` and `https` addresses are let through. A page opened by URL has its relative addresses resolved against that URL; a page opened as a `File`, `Blob` or `ArrayBuffer` has no address, so only absolute addresses work. Each address the page loads is a request the page's author chose, so they can tell that someone opened it.

### Links

| `links`    | A click on a link…                                                                     |
| ---------- | -------------------------------------------------------------------------------------- |
| `'none'`   | …does nothing. This is the default.                                                    |
| `'viewer'` | …opens the page inside the viewer, like a link in a browser.                           |
| `'window'` | …opens `http`, `https` and `mailto` links in a new window that cannot reach your page. |

- Links to a place in the same page (`#section`) always scroll the page.
- Addresses that could run code (`javascript:`, `data:`) are removed from the page, so there is nothing to follow.
- With `'viewer'`, a site that opens may refuse to be shown in a frame, and the viewer has no back button. A page opened inside the viewer is no longer under the policy above, so use it for pages you trust.
- To handle links yourself, pass `onNavigate`. It is called for any link to another page, whatever `links` says:

```jsx
<HtmlViewer source={file} onNavigate={(href) => router.open(href)} />
```

### Scripts

```jsx
<HtmlViewer source={file} allowScripts />
```

The page's inline scripts run, in a frame of their own that cannot reach your page, its cookies or its storage. The policy still stops a script asking the network for anything. Scripts from other addresses never run.

Because the frame is walled off from your page, some things cannot work while scripts are on:

- Words cannot be marked: `onMarked` is called with `false` if you give a `target`.
- `onNavigate` and `links="window"` do not work. Links go nowhere unless you use `links="viewer"`.
- A script can still send the reader's frame to another address, which tells that site that the page was opened.

Only switch scripts on for pages you trust.

## Examples

### Show a search result

```jsx
<HtmlViewer
  source={file}
  target={{ before: 'The price of', matched: 'wheat', after: 'rose' }}
  onMarked={(found) => found === false && console.log('The words are not in the page')}
/>
```

Words are looked for in what the page shows, not in its scripts, styles or title.

### Load a URL with a sign-in token

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<HtmlViewer source="https://example.com/report.html" fetcher={fetcher} />;
```

Pictures and styles the page asks for (when you allow them) are requested by the browser, without your `fetcher`.

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so `.html` and `.htm` files open here automatically. Props such as `allowImages` are passed on.

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} allowImages allowStyles />;
```

## Good to know

- **Colours:** a page is drawn for a white background, whatever `theme` you give the other viewers.
- **Encoding:** text is read as UTF-8.
- **Frames inside a page:** they are removed, unless scripts are on.
- **Why `allow-same-origin`:** with scripts off, the viewer reaches into the frame to mark words and handle links, which needs `allow-same-origin`. That is safe only because no script can run there. With scripts on, the frame never has it: together, the two would let the page lift its own sandbox.

## Accessibility

- The page is in a frame with a title, set with `label`. Give each viewer a clear label when a page shows more than one.
- What is inside the frame is the file's own page, so its accessibility is whatever the page provides.
- A loading message and any error are announced.

## License

MIT
