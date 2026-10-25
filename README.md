# Fovea Viewers

File viewers for React apps. Install only the viewers you need, or let the shared package pick the right one for any file.

> Work in progress. The [text](packages/fovea-text/README.md), [Markdown](packages/fovea-markdown/README.md) and [code](packages/fovea-code/README.md) viewers are available; the others are being added one at a time.

## Viewers

| Package                                                             | Opens                            |
| ------------------------------------------------------------------- | -------------------------------- |
| [`@coldsofttech/fovea-code`](packages/fovea-code/README.md)         | Source code and logs (available) |
| `@coldsofttech/fovea-email`                                         | Email messages                   |
| `@coldsofttech/fovea-excel`                                         | Excel workbooks                  |
| `@coldsofttech/fovea-feed`                                          | RSS and Atom feeds               |
| `@coldsofttech/fovea-html`                                          | HTML pages                       |
| `@coldsofttech/fovea-image`                                         | Images                           |
| [`@coldsofttech/fovea-markdown`](packages/fovea-markdown/README.md) | Markdown (available)             |
| `@coldsofttech/fovea-pdf`                                           | PDF files                        |
| `@coldsofttech/fovea-powerpoint`                                    | PowerPoint presentations         |
| `@coldsofttech/fovea-table`                                         | CSV and TSV tables               |
| [`@coldsofttech/fovea-text`](packages/fovea-text/README.md)         | Plain text (available)           |
| `@coldsofttech/fovea-word`                                          | Word documents                   |

`@coldsofttech/fovea-viewers` works out which viewer fits a file and loads it only when needed, so a viewer's libraries are only downloaded by the people who open that kind of file.

React and `react-dom` 18 or 19 must be installed in your app.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
