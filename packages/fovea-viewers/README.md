# @coldsofttech/fovea-viewers

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-viewers)](https://www.npmjs.com/package/@coldsofttech/fovea-viewers)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

Opens any file in the right Fovea viewer. Give it a file, a URL or some bytes and it works out what the file is, loads the viewer for it and shows it. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- One component, `Viewer`, for twelve kinds of file: text, code, Markdown, HTML, feeds, tables, images, PDF, email, Excel, Word and PowerPoint.
- Picks the viewer from the file's name, URL or MIME type, or from a `type` you give it.
- Loads a viewer only when a file needs it, so your app only pays for the viewers it opens.
- Install only the viewers you want. If one is missing, the error tells you which package to install.
- The same props, theme and error handling for every viewer.
- Safe by default: files are treated as untrusted, nothing is fetched except through the `fetcher` you give it, and each viewer keeps scripts and web content out unless you allow them.
- Also holds the code the viewers share, for building your own.

## Install

```bash
npm install @coldsofttech/fovea-viewers
```

Then install the viewers you want. Each one is its own package:

```bash
npm install @coldsofttech/fovea-text @coldsofttech/fovea-markdown @coldsofttech/fovea-pdf
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';
import '@coldsofttech/fovea-text/style.css';

<div style={{ height: 500 }}>
  <Viewer source={file} theme="dark" />
</div>;
```

Import the style sheet of each viewer you use (see [Styles](#styles)). A viewer fills the height of its parent, so give the parent a height.

`source` can be:

- a URL string, such as `'/files/report.pdf'`
- a `File` or `Blob`, for example from a file input
- an `ArrayBuffer` of raw bytes (see [How the viewer is picked](#how-the-viewer-is-picked))

## Viewers and the files they open

| Package                          | `type`       | Opens                                                                                                       |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `@coldsofttech/fovea-text`       | `text`       | `.txt`, `.log`                                                                                              |
| `@coldsofttech/fovea-code`       | `code`       | Source code and data files: `.js`, `.ts`, `.py`, `.java`, `.json`, `.yaml`, `.xml`, `.sql`, `.log` and more |
| `@coldsofttech/fovea-markdown`   | `markdown`   | `.md`, `.markdown`                                                                                          |
| `@coldsofttech/fovea-html`       | `html`       | `.html`, `.htm`                                                                                             |
| `@coldsofttech/fovea-feed`       | `feed`       | `.rss`, `.atom`                                                                                             |
| `@coldsofttech/fovea-table`      | `table`      | `.csv`, `.tsv`                                                                                              |
| `@coldsofttech/fovea-image`      | `image`      | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.avif`                                           |
| `@coldsofttech/fovea-pdf`        | `pdf`        | `.pdf`                                                                                                      |
| `@coldsofttech/fovea-email`      | `email`      | `.eml`                                                                                                      |
| `@coldsofttech/fovea-excel`      | `excel`      | `.xlsx`, `.xlsm`                                                                                            |
| `@coldsofttech/fovea-word`       | `word`       | `.docx`, `.docm`                                                                                            |
| `@coldsofttech/fovea-powerpoint` | `powerpoint` | `.pptx`, `.pptm`                                                                                            |

Each viewer's own README lists everything it can do and the extra props it takes. The code viewer opens many more extensions than the table shows, so see [its README](../fovea-code/README.md) for the full list.

## How the viewer is picked

`Viewer` looks at, in this order:

1. The `type` prop, if you gave one.
2. The MIME type of `source` (a `File` or `Blob` has one).
3. The file name or URL of `source`, using its extension. A query string or `#` fragment is ignored.

If nothing matches, `Viewer` shows an error and calls `onError`. Two cases to know:

- **`.log` files** open in the code viewer, in colour, when it is installed. Pass `type="text"` to open them as plain text.
- **Raw bytes.** An `ArrayBuffer` has no name or MIME type, so pass a `type`, for example `type="pdf"`.

## Props

`Viewer` takes the props below. Any other prop is passed on to the viewer it opens, so you can use that viewer's own options (for example `pageSize` for a table, `links` for HTML, or `allowImages` for email).

| Prop      | Description                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `source`  | The file: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                                             |
| `type`    | Which viewer to use, for example `'markdown'`. Worked out from `source` when left out.                                       |
| `fetcher` | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests. Defaults to `fetch`.        |
| `theme`   | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's own colours.                                    |
| `label`   | The accessible name of the viewer.                                                                                           |
| `onReady` | Called when the file has loaded and is shown. What it receives depends on the viewer (for example the number of pages).      |
| `onError` | Called with an `Error` when the file cannot be loaded or shown, or when no viewer fits. The `Viewer` also shows the message. |

While a viewer is being loaded, `Viewer` shows "Loading…".

## Theme

`theme="light"` and `theme="dark"` use built-in colours. To use your own, pass an object. Each entry sets one colour, and any you leave out fall back to the page's colours.

```jsx
<Viewer
  source={file}
  theme={{
    background: '#101820',
    foreground: '#f2f2f2',
    link: '#6cb6ff',
  }}
/>
```

| Name                | What it colours                         |
| ------------------- | --------------------------------------- |
| `background`        | The viewer's background.                |
| `foreground`        | Text.                                   |
| `muted`             | Less prominent text.                    |
| `border`            | Lines and borders.                      |
| `gutter-background` | Headers, gutters and sticky bars.       |
| `current-line`      | A hovered or current line, row or item. |
| `hit-background`    | The background of found words.          |
| `hit-outline`       | The outline of found words.             |
| `link`              | Links, selections and focus rings.      |
| `code-background`   | Code blocks and inline code.            |

Each name becomes a CSS custom property, `--fovea-<name>`, on the viewer, so you can also set them from your own style sheet.

## Styles

Each viewer comes with a small style sheet. Import the one for every viewer you use, once, somewhere in your app:

```jsx
import '@coldsofttech/fovea-markdown/style.css';
import '@coldsofttech/fovea-pdf/style.css';
```

Every viewer has a `style.css` to import except the code viewer, which has none.

## Examples

### Choose the viewer yourself

```jsx
<Viewer source={buffer} type="pdf" />
```

### Open a file that needs a sign-in

```jsx
<Viewer
  source="/api/files/42"
  type="pdf"
  fetcher={(url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } })}
/>
```

A URL with no extension, such as the one above, needs a `type`.

### Open a log as plain text

```jsx
<Viewer source="/logs/app.log" type="text" />
```

### Handle errors

```jsx
<Viewer
  source={file}
  onError={(error) => console.error(error.message)}
  onReady={(info) => console.log('ready', info)}
/>
```

If the viewer for the file is not installed, the message says which package to add, for example `npm install @coldsofttech/fovea-pdf`.

### Check whether a file can be opened

```jsx
import { resolve } from '@coldsofttech/fovea-viewers';

resolve('report.pdf'); // 'pdf'
resolve('text/csv'); // 'table'
resolve(file); // the id for a File or Blob, from its type and name
resolve('archive.zip'); // null
```

### Load a viewer ahead of time

```jsx
import { load } from '@coldsofttech/fovea-viewers';

// For example when the user hovers over a "Preview" button.
load('pdf');
```

## Functions

| Export              | Description                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Viewer`            | The component described above.                                                                              |
| `resolve(input)`    | Returns the viewer id for a `File`, `Blob`, MIME type, file name or URL, or `null` when none fits.          |
| `load(id)`          | Loads a viewer package and returns it. Rejects with an install hint when the package is not installed.      |
| `registry`          | The list of viewers: each has an `id`, the `mimeTypes` and `extensions` it opens, and how to load it.       |
| `componentName(id)` | The name a viewer package exports its component under, for example `componentName('pdf')` is `'PdfViewer'`. |

## Shared code

`@coldsofttech/fovea-viewers/core` holds what the viewers have in common. You do not need it to use `Viewer`. It is useful if you build a viewer of your own, or want the same behaviour in your app.

| Export                                           | What it is                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `readSource`, `useSource`, `useText`             | Read a source (URL, `File`, `Blob` or bytes) as a `Blob`, or as text, with loading and error state.                               |
| `themeVars`, `lightTheme`, `darkTheme`           | Turn a `theme` into CSS custom properties, and the built-in colours.                                                              |
| `Grid`, `compareCells`                           | An unstyled table with sortable headers, paging, cell styles, merged cells and column widths. You pass `classNames` to style it.  |
| `HtmlFrame`, `prepareHtml`                       | A locked-down frame for untrusted web pages: nothing loads from the web, no script runs and links do nothing unless you allow it. |
| `markIn`, `clearMarks`                           | Find and highlight words in what a viewer shows.                                                                                  |
| `bestMatch`, `scoreMatch`, `squash`, `isIgnored` | Compare words while ignoring spaces, case and markup, to pick the best place for a match.                                         |
| `useLatest`                                      | Keep the latest callback without restarting effects.                                                                              |

## Good to know

- **Viewers are optional.** They are listed as optional peer dependencies, so installing this package alone adds no viewer. Install each one you need.
- **Bundlers.** Every viewer is loaded with a dynamic `import()`, so bundlers such as Vite, webpack and Rollup put each one in its own file and load it when a file is opened. The Excel, PDF, Word and PowerPoint viewers also load their file readers on demand.
- **Untrusted files.** Content from files is never trusted. HTML, email and Markdown are cleaned, scripts are off by default, and the only network requests are the ones made through your `fetcher` (or `fetch` if you gave none) and the pictures or styles you choose to allow.
- **Props that a viewer does not use** are ignored, so you can keep one set of props for several kinds of file.
- **One file at a time.** Change `source` and the viewer shows the new file. Give `Viewer` a `key` to start a fresh viewer for each file.

## Accessibility

`Viewer` shows loading as a status message and errors as an alert, so screen readers announce both. Each viewer works with the keyboard and screen readers. See the viewer's README for the details.

## License

MIT
