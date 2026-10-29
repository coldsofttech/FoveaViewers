# Fovea Viewers

[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

File viewers for React apps. Show a text file, a PDF, an Excel workbook, an email, a Word document, a PowerPoint deck and more, right inside your page, without sending the file to anyone. Install only the viewers you need, or let the shared package pick the right one for any file.

## Why Fovea Viewers

- **One way to open anything.** Give a viewer a URL, a `File` or `Blob`, or raw bytes. Every viewer takes the same basic props, theme and error handling.
- **Install only what you use.** Each file type is its own package. A page that shows Markdown never downloads a PDF reader.
- **Loaded when needed.** Heavy libraries (PDF, Excel, Word, PowerPoint) are only fetched when someone opens that kind of file.
- **Safe by default.** Files are treated as untrusted. Pages and emails are cleaned, nothing loads from the web, no script runs and no macro runs, unless you switch it on.
- **Find and mark.** Most viewers can scroll to some words and highlight them, for example to show a search result.
- **Light and dark.** Built-in themes, or your own colours.
- **Accessible.** Works with the keyboard and screen readers.
- **Client-side.** Everything runs in the browser. Files stay on the reader's machine unless you load them from a URL.

## Viewers

| Package                                                                 | Component          | Opens                                                                    |
| ----------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| [`@coldsofttech/fovea-text`](packages/fovea-text/README.md)             | `TextViewer`       | Plain text and logs, with line numbers                                   |
| [`@coldsofttech/fovea-code`](packages/fovea-code/README.md)             | `CodeViewer`       | Source code and data files in colour, such as JavaScript, Python and C++ |
| [`@coldsofttech/fovea-markdown`](packages/fovea-markdown/README.md)     | `MarkdownViewer`   | Markdown, with tables, task lists and footnotes                          |
| [`@coldsofttech/fovea-html`](packages/fovea-html/README.md)             | `HtmlViewer`       | Saved web pages, locked down                                             |
| [`@coldsofttech/fovea-feed`](packages/fovea-feed/README.md)             | `FeedViewer`       | RSS and Atom feeds                                                       |
| [`@coldsofttech/fovea-table`](packages/fovea-table/README.md)           | `TableViewer`      | CSV and TSV tables, with sortable columns                                |
| [`@coldsofttech/fovea-image`](packages/fovea-image/README.md)           | `ImageViewer`      | PNG, JPEG, GIF, WebP, AVIF, BMP and SVG                                  |
| [`@coldsofttech/fovea-pdf`](packages/fovea-pdf/README.md)               | `PdfViewer`        | PDF files                                                                |
| [`@coldsofttech/fovea-email`](packages/fovea-email/README.md)           | `EmailViewer`      | Email messages (`.eml`)                                                  |
| [`@coldsofttech/fovea-excel`](packages/fovea-excel/README.md)           | `ExcelViewer`      | Excel workbooks (`.xlsx`, `.xlsm`)                                       |
| [`@coldsofttech/fovea-word`](packages/fovea-word/README.md)             | `WordViewer`       | Word documents (`.docx`, `.docm`)                                        |
| [`@coldsofttech/fovea-powerpoint`](packages/fovea-powerpoint/README.md) | `PowerpointViewer` | PowerPoint presentations (`.pptx`, `.pptm`)                              |

[`@coldsofttech/fovea-viewers`](packages/fovea-viewers/README.md) is the shared package. It works out which viewer fits a file and loads it only when needed.

### What each viewer does

- **Text.** Line numbers, jump to a line, and only the lines in view are drawn, so very large files open at once.
- **Code.** Colours that match VS Code for many kinds of file, a readable layout for minified files, and find-and-mark.
- **Markdown.** Tables, task lists, footnotes, safe links and images, fast scrolling on large files and scroll-to-match.
- **HTML.** Shows a page as a browser would, but with scripts, web pictures, web styles and links all off until you allow them.
- **Feed.** RSS and Atom, with rich text, pictures and links on request, and paging.
- **Table.** Any delimiter, a header-row choice, sortable headers that stay in view, and paging.
- **Image.** Fit modes, zoom, panning by mouse or keyboard, rotation and an info bar.
- **PDF.** Pages drawn as they come into view, selectable text, zoom and fit, turning, page numbers, an outline, password-protected files and find-and-mark.
- **Email.** Sender, recipients, date and subject, formatted or plain text, attachments, embedded pictures and the raw headers. Tracking pixels and remote content stay blocked.
- **Excel.** A tab for each sheet with cell styles, merged cells, column widths and number formats, formulas on request, sorting, paging and find-and-mark.
- **Word.** Headings, lists, tables, links and pictures, a report of what could not be shown, and find-and-mark.
- **PowerPoint.** Slide text, tables and pictures, slide buttons and keys, a strip of small slides, speaker notes and find-and-mark.

Each viewer's README lists its options and what it leaves out.

## Install

Install the shared package and the viewers you want:

```bash
npm install @coldsofttech/fovea-viewers @coldsofttech/fovea-markdown @coldsofttech/fovea-pdf
```

Or use one viewer on its own, without the shared package's file detection:

```bash
npm install @coldsofttech/fovea-markdown @coldsofttech/fovea-viewers
```

(Every viewer needs `@coldsofttech/fovea-viewers` next to it for the code they share.)

React and `react-dom` 18 or 19 must be installed in your app. Use a bundler that understands ES modules and dynamic `import()`, such as Vite, webpack or Rollup.

## Use

### Let the shared package pick the viewer

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';
import '@coldsofttech/fovea-markdown/style.css';
import '@coldsofttech/fovea-pdf/style.css';

<div style={{ height: 600 }}>
  <Viewer source={file} theme="dark" />
</div>;
```

`Viewer` looks at the file's type or name, loads the matching viewer and shows the file. If that viewer is not installed, it tells you which package to add.

### Use one viewer directly

```jsx
import { PdfViewer } from '@coldsofttech/fovea-pdf';
import '@coldsofttech/fovea-pdf/style.css';

<div style={{ height: 600 }}>
  <PdfViewer source="/files/report.pdf" />
</div>;
```

A viewer fills the height of its parent, so give the parent a height.

## What every viewer accepts

| Prop      | Description                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- |
| `source`  | The file: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                    |
| `fetcher` | Optional `(url) => Promise<Response>` for URL sources, so you control sign-in and requests.         |
| `theme`   | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's own colours.           |
| `label`   | The accessible name of the viewer.                                                                  |
| `onReady` | Called when the file is shown, with details that depend on the viewer (for example the page count). |
| `onError` | Called with an `Error` when the file cannot be loaded or shown.                                     |

Each viewer adds its own options, such as `pageSize` for tables, `allowImages` for pages and emails, or `slide` for presentations.

### Signing in to load a file

```jsx
<Viewer
  source="/api/files/42"
  type="pdf"
  fetcher={(url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } })}
/>
```

### Showing a search result

The viewers that can search take the words to find and mark them, scrolling to the right place. For some it is also the right sheet, slide or page.

```jsx
<HtmlViewer source={file} target={{ matched: 'wheat', before: 'Winter ', after: ' prices' }} />
```

The text, Markdown, code, HTML, feed, PDF, Excel, Word and PowerPoint viewers can do this. The prop and the shape of what you pass differ a little between viewers (Markdown also takes a line number, and the code viewer calls it `match`), so check the viewer's README.

## Safe by default

Files from users and from the web cannot be trusted, so the viewers are careful.

- HTML, email and Markdown are cleaned before they are shown. Scripts, forms and frames are removed.
- Web pictures, styles and fonts do not load unless you allow them. This also stops tracking pixels in emails.
- Links do nothing until you say what they should do.
- Macros in Word, Excel and PowerPoint files are never run.
- The only network requests are for the file itself, made through your `fetcher` (or `fetch`), and any pictures or styles you choose to allow.

See [docs/security.md](docs/security.md) for how this is done and which checks run on every change.

## Try it

The demo app opens a sample of every kind of file, with controls for the theme, pictures, links and more.

```bash
npm ci
npm run build
npm run dev
```

You can also open any file of your own with the "open a file" box.

## Documentation

- The README of each package, linked in the table above.
- [CHANGELOG.md](CHANGELOG.md) for what changed.
- [docs/](docs/README.md) for how the repository works: [development](docs/development.md), [security](docs/security.md), [third-party notices](docs/third-party-notices.md) and [repository setup](docs/repo-setup.md).
- [SUPPORT.md](SUPPORT.md) for where to ask questions and report bugs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Released under the [MIT License](LICENSE). The libraries the viewers use have permissive licenses of their own, listed in [docs/third-party-notices.md](docs/third-party-notices.md).
