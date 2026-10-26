# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Package setup for the Fovea viewers and the shared `@coldsofttech/fovea-viewers` package, which picks and loads the right viewer for a file.
- Text viewer (`@coldsofttech/fovea-text`) with line numbers, scroll-to-line and light and dark themes.
- `Viewer` component in `@coldsofttech/fovea-viewers` that opens a file in the matching viewer.
- Markdown viewer (`@coldsofttech/fovea-markdown`) with tables, task lists, footnotes, safe links and images, fast scrolling on large files, and scroll-to-match.
- Code viewer (`@coldsofttech/fovea-code`) with VS Code colours for 26 kinds of file including C and C++, a layout for minified files, and find-and-mark. Logs now open in colour here, and still open as plain text in the text viewer.
- `LineViewer` in `@coldsofttech/fovea-text`, which shows lines you give it with optional colours.
- HTML viewer (`@coldsofttech/fovea-html`) that is safe by default, with scripts, links, pictures and styles each switched on by choice, and find-and-mark.
- Feed viewer (`@coldsofttech/fovea-feed`) for RSS and Atom feeds, safe by default, with rich text, pictures and link handling switched on by choice, paging and find-and-mark.
