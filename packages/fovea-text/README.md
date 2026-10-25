# @coldsofttech/fovea-text

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-text)](https://www.npmjs.com/package/@coldsofttech/fovea-text)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A plain text viewer with line numbers for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens a file from a URL, a `File` or `Blob`, or raw bytes.
- Only the lines in view are drawn, so files with hundreds of thousands of lines open at once.
- Line numbers that stay in place while you scroll sideways.
- Scrolls to a line and marks words on it, for example to show a search result.
- Light and dark themes, your own colours, or the colours of the page it sits in.
- You control how URLs are requested, for example to add a sign-in token.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-text @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { TextViewer } from '@coldsofttech/fovea-text';
import '@coldsofttech/fovea-text/style.css';

<div style={{ height: 400 }}>
  <TextViewer source={file} theme="dark" label="Release notes" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Props

| Prop         | Description                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `source`     | The file: a URL string, a `File` or `Blob`, or an `ArrayBuffer`. Text is read as UTF-8.               |
| `fetcher`    | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.      |
| `theme`      | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's colours.                 |
| `label`      | The accessible name. Defaults to `Text`.                                                              |
| `target`     | `{ line, column?, length? }`: scrolls to a line (from 1) and marks `length` characters from `column`. |
| `lineHeight` | Height of every line in pixels. Defaults to 20.                                                       |
| `onReady`    | Called with `{ lineCount }` once the text is shown.                                                   |
| `onError`    | Called with an `Error` when the file cannot be loaded. The viewer also shows the message.             |

## Examples

### Show a search result

Scroll to line 5231 and mark the five characters starting at column 17. Changing `target` scrolls again.

```jsx
<TextViewer source={file} target={{ line: 5231, column: 17, length: 5 }} />
```

Leave out `column` and `length` to scroll to a line and shade it without marking any words.

### Load a URL with a sign-in token

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<TextViewer source="https://example.com/logs/app.log" fetcher={fetcher} />;
```

Pass a stable function, for example one from `useCallback`. A new function on every render makes the file load again.

### React to loading

```jsx
<TextViewer
  source={file}
  onReady={({ lineCount }) => console.log(`${lineCount} lines`)}
  onError={(error) => reportProblem(error.message)}
/>
```

### Custom colours

Pass an object to `theme`. Each key becomes a CSS variable named `--fovea-<key>`. The keys are `background`, `foreground`, `muted`, `border`, `gutter-background`, `current-line`, `hit-background` and `hit-outline`. Keys you leave out use the page's colours.

```jsx
<TextViewer source={file} theme={{ background: '#fffbe6', foreground: '#222' }} />
```

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so `.txt` files open here automatically. A `.log` file can be shown here too, as plain text, but `Viewer` opens it in `@coldsofttech/fovea-code`, which colours it. To keep it plain, ask for this viewer with `type="text"`.

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} theme="dark" />;
```

### Show lines you already have

`LineViewer` is what `TextViewer` shows once it has read a file. Give it the lines yourself, and optionally a `tokens` function that colours a line in pieces. Each piece is `[kind, text]`, drawn in the colour of the CSS variable `--fovea-token-<kind>` (set them with `theme`). The code viewer is built this way.

```jsx
import { LineViewer } from '@coldsofttech/fovea-text';

const tokens = (text) => (text.startsWith('#') ? [['comment', text]] : null);

<LineViewer lines={lines} tokens={tokens} theme={{ 'token-comment': '#6a9955' }} />;
```

Pass a stable `tokens` function, for example one from `useCallback`, because the visible lines are drawn again when it changes. `LineViewer` also takes `status`, `error`, `label`, `target`, `lineHeight`, `onReady` and `onError`, with the same meaning as above.

## Good to know

- **Encoding:** text is read as UTF-8. Other encodings show as garbled characters.
- **Line breaks:** `\n`, `\r\n` and `\r` all end a line. A final line break does not add an empty line.
- **No wrapping:** lines keep their length and a long line scrolls sideways. Tabs and spaces are shown as they are.
- **Memory:** the whole file is read into memory once, so the largest file you can open depends on the browser.
- **Copying:** only the lines that are drawn can be selected and copied, so selecting all copies the lines near the view rather than the whole file. Line numbers are never copied.
- **No highlighting:** this viewer shows plain text. For source code and coloured logs, use `@coldsofttech/fovea-code`.
- **Binary files:** they are not detected and show as unreadable text.

## Accessibility

- The viewer is a labelled region that takes keyboard focus, so arrow keys, Page Up, Page Down, Home and End scroll it.
- Screen readers read the text of each line. Line numbers are hidden from them.
- A loading message and any error are announced.
- Give each viewer a clear `label` when a page shows more than one.

## License

MIT
