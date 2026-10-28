# Third-party notices

Fovea Viewers is released under the [MIT license](../LICENSE). This page lists the packages its viewers depend on at runtime and the licenses they use. Development tools (test runners, linters, build tools) are not shipped and are not listed.

Every runtime dependency uses a permissive license. None uses GPL, LGPL or AGPL, so all of them can be used alongside the MIT license.

## Direct dependencies

| Package                  | License                 | Used by                 |
| ------------------------ | ----------------------- | ----------------------- |
| `dompurify`              | MPL-2.0 OR Apache-2.0   | viewers, markdown, feed |
| `exceljs`                | MIT                     | excel                   |
| `jszip`                  | MIT OR GPL-3.0-or-later | powerpoint              |
| `mammoth`                | BSD-2-Clause            | word                    |
| `markdown-it`            | MIT                     | markdown                |
| `markdown-it-footnote`   | MIT                     | markdown                |
| `markdown-it-task-lists` | ISC                     | markdown                |
| `pdfjs-dist`             | Apache-2.0              | pdf                     |
| `postal-mime`            | MIT-0                   | email                   |

The text, code, image, table and html viewers have no runtime dependencies. `react` and `react-dom` are peer dependencies that your app provides.

## All runtime dependencies, by license

This counts the direct dependencies and everything they depend on: 217 packages in all.

| License                                                                                               | Packages |
| ----------------------------------------------------------------------------------------------------- | -------- |
| MIT                                                                                                   | 183      |
| ISC                                                                                                   | 14       |
| BSD-2-Clause                                                                                          | 5        |
| Apache-2.0                                                                                            | 3        |
| BSD-3-Clause                                                                                          | 3        |
| MIT-0, MIT AND Zlib, MIT/X11, Unlicense, PSF-2.0, BSD, MIT OR GPL-3.0-or-later, MPL-2.0 OR Apache-2.0 | 1 each   |
| No license field                                                                                      | 1        |

## Notes

- **Dual-licensed packages.** `jszip` (MIT or GPL-3.0-or-later) is used under MIT. `dompurify` (MPL-2.0 or Apache-2.0) is used under Apache-2.0. Both are installed as ordinary dependencies and are not copied into this repository's packages.
- **PDF worker.** `fovea-pdf` ships a copy of pdf.js's worker file (Apache-2.0) in its `dist` folder. The file keeps its own license header.
- **Package with no license field.** `buffers@0.1.1` declares no license and its README does not mention one. It is reached only through `exceljs` → `unzipper` → `binary`, which is code for Node and not for the browser. Its upstream repository should be checked before the first release.
- **Other permissive licenses.** `argparse` (through `markdown-it`) is PSF-2.0, the permissive Python license. `duck` (through `mammoth`) is listed as plain "BSD".

## Keeping this up to date

The lists above come from the installed `node_modules` of the published packages. Update this page when a runtime dependency is added, removed or upgraded to a new major version.
