# @coldsofttech/fovea-pdf

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-pdf)](https://www.npmjs.com/package/@coldsofttech/fovea-pdf)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A PDF viewer for React, plain JavaScript and as a Web Component. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time. PDFs are read with [PDF.js](https://mozilla.github.io/pdf.js/) from Mozilla.

## Features

- Opens a PDF from a URL, a `File` or `Blob`, or raw bytes.
- Pages are drawn as they come into view, so a PDF with hundreds of pages opens at once.
- Text can be selected and copied.
- Fits pages to the width or to the whole view, and zooms with buttons, keys and Ctrl + wheel (or a pinch).
- Turns pages in quarter turns.
- Shows the page you are on, and goes to any page.
- Shows the PDF's outline (its table of contents) and goes to an item.
- Asks for a password when a PDF is protected.
- Finds words in the PDF and marks them, for example to show a search result.
- Light and dark themes for the viewer around the pages, your own colours, or the colours of the page it sits in.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-pdf @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app if you use the React component. The plain JavaScript and Web Component entry points (below) need no React. PDF.js comes with this package and is loaded only when a PDF is first opened.

## Use

```jsx
import { PdfViewer } from '@coldsofttech/fovea-pdf';
import '@coldsofttech/fovea-pdf/style.css';

<div style={{ height: 600 }}>
  <PdfViewer source="https://example.com/report.pdf" theme="dark" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Without React

The same viewer is available from plain JavaScript and as a Web Component. Neither needs React.

```js
import { createPdfViewer } from '@coldsofttech/fovea-pdf/vanilla';
import '@coldsofttech/fovea-pdf/style.css';

const viewer = createPdfViewer(document.getElementById('host'), {
  source: file, // a URL, File, Blob or ArrayBuffer
  password: 'secret',
  target: { matched: 'invoice' },
  onError: (error) => console.error(error),
});

viewer.update({ theme: 'dark' }); // change props later
viewer.destroy(); // remove the viewer and stop loading
```

`createPdfViewer(container, props)` takes the props in the table below and returns `{ element, update, destroy }`. The container needs a height. The pdf.js worker comes with this package (`dist/pdf.worker.min.mjs`) and is found from the code that starts it, as for the React component, so a bundler such as Vite serves it with your app. Set `workerSrc` (or the `worker-src` attribute) if your bundler cannot find it.

```html
<script type="module">
  import '@coldsofttech/fovea-pdf/element'; // registers <fovea-pdf>
</script>

<fovea-pdf src="/files/report.pdf" style="height: 600px"></fovea-pdf>
```

The element draws into a shadow root, so no stylesheet has to be imported and the page's styles do not leak in. It fills the height of its parent, or the height you give it.

| Attribute or property                      | Notes                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src` / `source`                           | A URL as an attribute. A `File`, `Blob` or `ArrayBuffer` goes in the `source` property. |
| `theme`                                    | `light` or `dark`. The property also takes an object of colours.                        |
| `label`, `password`, `fit`, `initial-page` | As the props of the same name.                                                          |
| `worker-src`                               | The `workerSrc` prop: the address of pdf.js's worker.                                   |
| `fetcher`, `target`                        | Properties only.                                                                        |

Events: `fovea-ready` (`event.detail.pageCount`), `fovea-located` (`event.detail` is the page the target is on, from 1, or `null`), `fovea-page-change` (`event.detail` is the page the reader is on) and `fovea-error` (`event.detail` is the `Error`). Colours also come from `--fovea-*` custom properties set on the element or on any ancestor.

## Props

| Prop           | Description                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `source`       | The PDF: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                                       |
| `fetcher`      | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                      |
| `theme`        | `'light'`, `'dark'`, or an object of colours for the viewer around the pages. Leave it out to use the page's colours. |
| `label`        | The accessible name. Defaults to `PDF document`.                                                                      |
| `password`     | A password to try first, for a protected PDF.                                                                         |
| `workerSrc`    | The address of PDF.js's worker. Defaults to the copy that comes with this package.                                    |
| `fit`          | How pages are first sized: `'width'` (the default) or `'page'`.                                                       |
| `initialPage`  | The page to open at, from 1. Defaults to 1.                                                                           |
| `target`       | `{ matched, before?, after? }`: words to find. Their page is scrolled to and the words are marked.                    |
| `onLocated`    | Called with the number (from 1) of the page the target is on, or `null` when it is on none.                           |
| `onPageChange` | Called with the page the reader is on, as they scroll.                                                                |
| `onReady`      | Called with `{ pageCount }` once the PDF is shown.                                                                    |
| `onError`      | Called with an `Error` when the file cannot be loaded or is not a PDF. The viewer also shows the message.             |

## Key props

### `source` and `fetcher`

A URL is loaded with `fetch`. To control the request, for example to send a sign-in token, pass a `fetcher`:

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<PdfViewer source="https://example.com/private.pdf" fetcher={fetcher} />;
```

The whole file is loaded before it is shown.

### `fit`

| `fit`     | Pages are first shown…                                              |
| --------- | ------------------------------------------------------------------- |
| `'width'` | …as wide as the view. This is the default; the reader scrolls down. |
| `'page'`  | …small enough that a whole page is in view at once.                 |

The reader can change this at any time with the **Width** and **Page** buttons, and keeps fitting as the viewer is resized until they zoom by hand.

### `password`

A protected PDF asks the reader for its password, with an **Open** button. If you already know it, pass `password` and the reader is not asked unless it is wrong:

```jsx
<PdfViewer source={file} password={password} />
```

The password is used only to open the file, in the browser. It is never sent anywhere.

### `target`, `onLocated`

Words are looked for in the text of every page. The page where the words and their surroundings agree best is scrolled to and the words are marked. Words in an image of text (a scan) cannot be found.

```jsx
<PdfViewer
  source={file}
  target={{ before: 'The price of', matched: 'wheat', after: 'rose' }}
  onLocated={(page) => page === null && console.log('The words are not in the PDF')}
/>
```

### `workerSrc`

PDF.js does its work in a separate worker. The worker is a file that comes with this package, and your bundler (Vite, webpack 5 and others) finds it and serves it with your app, so you do not need to do anything. Set `workerSrc` if your bundler cannot, or to serve the worker from a place you choose, for example under a strict Content-Security-Policy:

```jsx
<PdfViewer source={file} workerSrc="/static/pdf.worker.min.mjs" />
```

Use the `pdf.worker.min.mjs` from the same version of `pdfjs-dist` that this package uses.

## Controls

| To…                  | Mouse                            | Keyboard (focus the pages first) |
| -------------------- | -------------------------------- | -------------------------------- |
| Scroll               | Wheel or scroll bar              | Arrow keys, Page Up, Page Down   |
| Zoom in or out       | `+` / `−` buttons, Ctrl + wheel  | `+` and `-`                      |
| Fit to the width     | **Width** button                 | `0`                              |
| Fit a whole page     | **Page** button                  | —                                |
| Turn left or right   | ↺ and ↻ buttons                  | `[` and `]`                      |
| Go to a page         | Type it in the page box          | Type it in the page box, Enter   |
| Show or hide outline | ☰ button (when the PDF has one) | —                                |

Zoom runs from 25% to 500%.

## Examples

### Open at a page, and follow the reader

```jsx
<PdfViewer source={file} initialPage={5} onPageChange={(page) => save(page)} />
```

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so `.pdf` files open here automatically. Props such as `password` are passed on.

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} password={password} />;
```

## Good to know

- **Pages are paper:** the theme colours the area around the pages. The pages themselves are always drawn as the PDF says, usually white.
- **Page sizes:** every page is laid out like the first until it has been drawn, so a PDF with pages of very different sizes may shift slightly as you scroll.
- **Large pages:** the picture of a page is capped in size, so a very high zoom on a big page is a little softer than the screen could show.
- **Fonts:** fonts inside the PDF are used. A PDF that relies on fonts it does not contain is drawn with fonts from the reader's device.
- **Links and forms:** links inside pages and fillable forms are not active. The outline is.
- **Scans:** a page that is only a picture has no text to select or find.
- **Licence:** PDF.js is licensed under Apache-2.0.

## Accessibility

- The pages are in a region named by `label`, which can be reached and scrolled with the keyboard. Each page is a group named `Page 1`, `Page 2` and so on.
- The text over each page is real text, so a screen reader can read it; the picture of the page is hidden from assistive technology.
- Every control is a labelled button or field, and the keyboard shortcuts above work without a mouse.
- A loading message, a password prompt and any error are announced.

## License

MIT
