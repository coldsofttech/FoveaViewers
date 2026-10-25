# @coldsofttech/fovea-markdown

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-markdown)](https://www.npmjs.com/package/@coldsofttech/fovea-markdown)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A Markdown viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens a file from a URL, a `File` or `Blob`, or raw bytes.
- Renders headings, lists, tables, code blocks, quotes, strikethrough, task lists and footnotes.
- Safe by default: raw HTML in the file is shown as text, scripts never run, and nothing is fetched unless you allow it.
- Links open in a new window, or go to your own handler.
- Stays fast on very large files, because only the parts near the screen are drawn.
- Can scroll to a line and mark words there, for example to show a search result.
- Light and dark themes, your own colours, or the colours of the page it sits in.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-markdown @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { MarkdownViewer } from '@coldsofttech/fovea-markdown';
import '@coldsofttech/fovea-markdown/style.css';

<div style={{ height: 500 }}>
  <MarkdownViewer source={file} theme="dark" label="Release notes" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Props

| Prop          | Description                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `source`      | The file: a URL string, a `File` or `Blob`, or an `ArrayBuffer`. Text is read as UTF-8.                              |
| `fetcher`     | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                     |
| `theme`       | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's colours.                                |
| `label`       | The accessible name. Defaults to `Markdown`.                                                                         |
| `allowImages` | Show pictures. Off by default, so they appear as their alt text. See below.                                          |
| `target`      | `{ line, matched, before?, after? }`: scrolls to a source line (from 1) and marks the words in the block there.      |
| `onNavigate`  | Optional `(href, event) => void`. When given, clicking a link calls it instead of opening the link.                  |
| `onMarked`    | Called with `true` when the target's words were marked, `false` when they are not in the page, `null` for no target. |
| `onReady`     | Called with `{ blockCount }` once the text is shown.                                                                 |
| `onError`     | Called with an `Error` when the file cannot be loaded. The viewer also shows the message.                            |

## Examples

### Show a search result

`line` is the line in the Markdown source. `matched` is the text the reader saw, without formatting marks. `before` and `after` help pick the right place when the words appear more than once.

```jsx
<MarkdownViewer
  source={file}
  target={{ line: 42, matched: 'bold text', before: 'Some', after: 'here' }}
  onMarked={(found) => found === false && console.log('The words are not in the rendered page')}
/>
```

If you only know the words, `locateInSource(markdown, { matched, before, after })` finds the source line and column for you:

```js
import { locateInSource } from '@coldsofttech/fovea-markdown';

const place = locateInSource(markdownText, { matched: 'bold text' });
// { offset, end, line, column } or null
```

### Handle links yourself

```jsx
<MarkdownViewer source={file} onNavigate={(href) => router.open(href)} />
```

Without `onNavigate`, links to `http`, `https` and `mailto` addresses open in a new window that cannot reach your page. Links to a place in the same file, such as footnotes, always scroll to it.

### Show pictures

```jsx
<MarkdownViewer source={file} allowImages />
```

Only pictures with an `http` or `https` address, or an embedded png, jpeg, gif or webp, are shown. Pictures are requested by the browser straight from their address without sending a referrer, so use this only for files you trust not to track readers.

### Load a URL with a sign-in token

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<MarkdownViewer source="https://example.com/docs/README.md" fetcher={fetcher} />;
```

Pass a stable function, for example one from `useCallback`. A new function on every render makes the file load again.

### Custom colours

Pass an object to `theme`. Each key becomes a CSS variable named `--fovea-<key>`. The keys are `background`, `foreground`, `muted`, `border`, `link`, `code-background`, `hit-background` and `hit-outline`. Keys you leave out use the page's colours.

```jsx
<MarkdownViewer source={file} theme={{ background: '#fffbe6', link: '#b00020' }} />
```

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so `.md` files open here automatically.

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} theme="dark" />;
```

## Safety

A Markdown file can be written by someone you do not trust, so the viewer is careful by default:

- Raw HTML in the file is shown as text, never as markup.
- Everything it makes is cleaned again before it is shown, which removes scripts, event handlers and styles.
- Links are followed only for `http`, `https`, `mailto` and in-page addresses. Other addresses, such as `javascript:`, are not links.
- Pictures are not loaded unless you set `allowImages`.
- The viewer makes no requests of its own besides loading the file itself.

## Good to know

- **Syntax:** it follows CommonMark with tables, strikethrough, task lists and footnotes. Code blocks are plain, with no syntax highlighting yet.
- **Task lists:** checkboxes show the state in the file and cannot be changed.
- **Headings:** they have no anchors, so a link such as `[x](#heading)` does nothing.
- **Encoding:** text is read as UTF-8.
- **Memory:** the whole file is read once, and drawn parts are dropped as they scroll away.
- **Copying:** only the parts that are drawn can be selected and copied, which are the parts near the view.

## Accessibility

- The viewer is a labelled region that takes keyboard focus, so arrow keys, Page Up, Page Down, Home and End scroll it.
- Headings, lists, tables and links are real elements, so screen readers can navigate by them.
- Task list checkboxes are labelled with their text.
- A loading message and any error are announced.
- Give each viewer a clear `label` when a page shows more than one.

## License

MIT
