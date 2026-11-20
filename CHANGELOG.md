# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Every viewer can be used without React: each package has a `/vanilla` entry (`createCodeViewer`, `createEmailViewer`, `createExcelViewer`, `createFeedViewer`, `createHtmlViewer`, `createImageViewer`, `createMarkdownViewer`, `createPdfViewer`, `createPowerpointViewer`, `createTableViewer`, `createTextViewer`, `createWordViewer`, and `createLineViewer` in the text package) and an `/element` entry that registers a Web Component (`<fovea-code>`, `<fovea-email>`, `<fovea-excel>`, `<fovea-feed>`, `<fovea-html>`, `<fovea-image>`, `<fovea-markdown>`, `<fovea-pdf>`, `<fovea-powerpoint>`, `<fovea-table>`, `<fovea-text>`, `<fovea-word>`). Each package also exports its CSS as a string from `/css`.
- `createViewer` (`@coldsofttech/fovea-viewers/vanilla`) and `<fovea-viewer>` (`@coldsofttech/fovea-viewers/element`): open a file in the matching viewer without React, loading the viewer when it is needed.
- `@coldsofttech/fovea-viewers/core/vanilla` and `@coldsofttech/fovea-viewers/core/element`: a React-free runtime (`createShell`, `loadText`, `applyTheme`, `createH`, `createGrid`, `createHtmlFrame`) and a helper that defines a viewer's Web Component. They are the base of the `/vanilla` and `/element` entry points of each viewer; their API may change before 1.0.
- `useController` in `@coldsofttech/fovea-viewers/core`, which runs a viewer's `/vanilla` controller from a React component.
- `examples/vanilla`, an app with no React that uses the viewers.

### Changed

- The React components of every viewer, `Grid` and `HtmlFrame` now draw through the `/vanilla` controllers. Their props and behaviour are the same. Each now renders inside one extra `div` (`display: contents` for `Grid` and `HtmlFrame`) and its root element carries a `data-fovea-root` attribute. A prop that is no longer given is treated as `undefined`, as in React before.
- React and `react-dom` are now optional peer dependencies of `@coldsofttech/fovea-viewers` and of every viewer package, so the React-free entry points need no React. Apps that use the React components already have React.

## [0.1.0] - 2026-10-28

### Added

- Package setup for the Fovea viewers and the shared `@coldsofttech/fovea-viewers` package, which picks and loads the right viewer for a file.
- Text viewer (`@coldsofttech/fovea-text`) with line numbers, scroll-to-line and light and dark themes.
- `Viewer` component in `@coldsofttech/fovea-viewers` that opens a file in the matching viewer.
- Markdown viewer (`@coldsofttech/fovea-markdown`) with tables, task lists, footnotes, safe links and images, fast scrolling on large files, and scroll-to-match.
- Code viewer (`@coldsofttech/fovea-code`) with VS Code colours for 26 kinds of file including C and C++, a layout for minified files, and find-and-mark. Logs now open in colour here, and still open as plain text in the text viewer.
- `LineViewer` in `@coldsofttech/fovea-text`, which shows lines you give it with optional colours.
- HTML viewer (`@coldsofttech/fovea-html`) that is safe by default, with scripts, links, pictures and styles each switched on by choice, and find-and-mark.
- Feed viewer (`@coldsofttech/fovea-feed`) for RSS and Atom feeds, safe by default, with rich text, pictures and link handling switched on by choice, paging and find-and-mark.
- Table viewer (`@coldsofttech/fovea-table`) for CSV and TSV files (with a delimiter of your choice), with sortable headers that stay in view, a header-row choice, any delimiter and paging.
- `Grid` in `@coldsofttech/fovea-viewers/core`, a table with sorting and paging that viewers share.
- Image viewer (`@coldsofttech/fovea-image`) for PNG, JPEG, GIF, WebP, AVIF, BMP and SVG, with fit modes, zoom, drag and keyboard panning, rotation and an info bar.
- PDF viewer (`@coldsofttech/fovea-pdf`) with pages drawn as they come into view, selectable text, zoom and fit, turning, page numbers, an outline, password-protected files and find-and-mark.
- Email viewer (`@coldsofttech/fovea-email`) for `.eml` messages, with sender, recipients, date, a plain-text option, attachments, embedded pictures and raw headers. Pictures and styles from the web stay off unless you switch them on.
- Excel viewer (`@coldsofttech/fovea-excel`) for `.xlsx` and `.xlsm` workbooks, with sheet tabs, cell styles, merged cells, formulas on request, paging and find-and-mark.
- Word viewer (`@coldsofttech/fovea-word`) for `.docx` and `.docm` documents, safe by default, with links on request, a report of what could not be shown, and find-and-mark.
- PowerPoint viewer (`@coldsofttech/fovea-powerpoint`) for `.pptx` and `.pptm` presentations, with slide text, tables and pictures, slide navigation, a thumbnail strip, speaker notes and find-and-mark.
- `HtmlFrame` in `@coldsofttech/fovea-viewers/core`, the safe page frame that the HTML and email viewers share.
- `Grid` in `@coldsofttech/fovea-viewers/core` can now style cells, merge them, set column widths and bring a row into view.
