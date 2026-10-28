# @coldsofttech/fovea-word

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-word)](https://www.npmjs.com/package/@coldsofttech/fovea-word)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A Word document viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens `.docx` and `.docm` files from a URL, a `File` or `Blob`, or raw bytes. Macros are never run.
- Shows headings, paragraphs, bold and italic text, lists, tables, links and pictures.
- Safe by default: nothing is loaded from the web, no script runs, and links do nothing until you allow them.
- Tells you what it could not show exactly as it is in the file.
- Finds words in the document and marks them, for example to show a search result.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-word @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { WordViewer } from '@coldsofttech/fovea-word';
import '@coldsofttech/fovea-word/style.css';

<div style={{ height: 500 }}>
  <WordViewer source={file} />
</div>;
```

The viewer fills the height of its parent, so give the parent a height. The reading code is loaded the first time a document is opened, so a page that never shows one never pays for it.

## Props

| Prop         | Description                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source`     | The document: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                                               |
| `fetcher`    | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                                   |
| `links`      | What a click on a link does: `'none'` (the default) or `'window'`, which opens `http`, `https` and `mailto` links in a new window. |
| `onNavigate` | Optional `(href, event) => void`. When given, a click on a link calls it instead of doing what `links` says.                       |
| `target`     | `{ matched, before?, after? }`: words to scroll to and mark in the document.                                                       |
| `onMarked`   | Called with `true` when the target's words were marked, `false` when they are not in the document, `null` for no target.           |
| `label`      | The accessible name. Defaults to `Word document`.                                                                                  |
| `onReady`    | Called with `{ messages }` once the document is shown.                                                                             |
| `onWarnings` | Called with a list of `{ type, message }` when something could not be shown as it is in the file.                                  |
| `onError`    | Called with an `Error` when the file cannot be loaded or read. The viewer also shows the message.                                  |

## Examples

### Open links in a new window

```jsx
<WordViewer source={file} links="window" />
```

### Show a search result

```jsx
<WordViewer
  source={file}
  target={{ matched: 'Revenue grew' }}
  onMarked={(found) => console.log(found)}
/>
```

### Know what was left out

```jsx
<WordViewer
  source={file}
  onWarnings={(messages) => messages.forEach((each) => console.warn(each.message))}
/>
```

### Open any file with `Viewer`

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} />;
```

## Good to know

- The document is shown as text that reflows to fit the width, not as pages. Fonts, sizes, page margins, headers, footers and text boxes are not kept.
- Pictures in the document show, because they are part of the file. Nothing is fetched from the web.
- Only `.docx` and `.docm` are supported, not the older `.doc`.

## Accessibility

The document is shown in a frame with an accessible name (`label`), and headings, lists and tables keep their meaning, so screen readers can move through them.

## License

MIT
