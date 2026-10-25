# Fovea Viewers

File viewers for React apps. Install only the viewers you need, or let the shared package pick the right one for any file.

> Work in progress. The packages are set up, and the viewers are being added one at a time.

## Viewers

| Package                          | Opens                    |
| -------------------------------- | ------------------------ |
| `@coldsofttech/fovea-code`       | Source code              |
| `@coldsofttech/fovea-email`      | Email messages           |
| `@coldsofttech/fovea-excel`      | Excel workbooks          |
| `@coldsofttech/fovea-feed`       | RSS and Atom feeds       |
| `@coldsofttech/fovea-html`       | HTML pages               |
| `@coldsofttech/fovea-image`      | Images                   |
| `@coldsofttech/fovea-markdown`   | Markdown                 |
| `@coldsofttech/fovea-pdf`        | PDF files                |
| `@coldsofttech/fovea-powerpoint` | PowerPoint presentations |
| `@coldsofttech/fovea-table`      | CSV and TSV tables       |
| `@coldsofttech/fovea-text`       | Plain text               |
| `@coldsofttech/fovea-word`       | Word documents           |

`@coldsofttech/fovea-viewers` works out which viewer fits a file and loads it only when needed, so a viewer's libraries are only downloaded by the people who open that kind of file.

React and `react-dom` 18 or 19 must be installed in your app.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
