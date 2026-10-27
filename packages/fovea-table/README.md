# @coldsofttech/fovea-table

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-table)](https://www.npmjs.com/package/@coldsofttech/fovea-table)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A CSV and TSV table viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens a file from a URL, a `File` or `Blob`, or raw bytes.
- Reads CSV, TSV and other delimited files, including quoted cells with commas and line breaks. The delimiter is found for you, or you can set it.
- Press a column header to sort by it: numbers sort as numbers, text in natural order.
- Headers stay in view while you scroll.
- Treats the first row as the headers, or not.
- Shows rows a page at a time, so a large file opens at once.
- Light and dark themes, your own colours, or the colours of the page it sits in.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-table @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { TableViewer } from '@coldsofttech/fovea-table';
import '@coldsofttech/fovea-table/style.css';

<div style={{ height: 500 }}>
  <TableViewer source="https://example.com/data.csv" theme="dark" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Props

| Prop        | Description                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `source`    | The file: a URL string, a `File` or `Blob`, or an `ArrayBuffer`. Text is read as UTF-8.           |
| `fetcher`   | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.  |
| `theme`     | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's colours.             |
| `label`     | The accessible name. Defaults to `Table`.                                                         |
| `delimiter` | The character between cells, for example `;`. Found from the first line when left out.            |
| `header`    | Treat the first row as the column headers. Defaults to `true`.                                    |
| `sortable`  | Let a header be pressed to sort. Defaults to `true`.                                              |
| `pageSize`  | How many rows are shown at once. Defaults to 100.                                                 |
| `onReady`   | Called with `{ rowCount, columnCount, delimiter }` once the table is shown.                       |
| `onError`   | Called with an `Error` when the file cannot be loaded or read. The viewer also shows the message. |

## Key props

### `delimiter`

By default the viewer looks at the first line and picks whichever of comma, tab, semicolon or bar appears most, so `.csv` and `.tsv` files open without any setup. Set it when a file is unusual, for example one where the first line gives no clue:

```jsx
<TableViewer source={file} delimiter="|" />
```

### `header`

On by default: the first row becomes the column headers. Turn it off for a file that is only data; the columns are then named `Column 1`, `Column 2` and so on, and every row is shown. An empty header cell is named the same way.

```jsx
<TableViewer source={file} header={false} />
```

### `sortable`

On by default. Press a column header to sort by it, again to reverse, and a third time to return to the original order. Numbers sort as numbers (`9` before `10`), other text sorts in natural order, and empty cells always come last. Screen readers are told the order of each column. Pass `sortable={false}` for a plain table.

### `pageSize`

Rows are shown a page at a time (100 by default), so a file with many thousands of rows opens at once. Previous and Next buttons and a "Rows 1–100 of 2500" label appear when there is more than one page. Sorting applies to all rows, not just the page you are on, and returns you to the first page.

## Examples

### Load a URL with a sign-in token

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<TableViewer source="https://example.com/data.csv" fetcher={fetcher} />;
```

### Know when it is ready

```jsx
<TableViewer
  source={file}
  onReady={({ rowCount, columnCount, delimiter }) => console.log(rowCount, columnCount, delimiter)}
/>
```

`rowCount` does not include the header row.

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so `.csv` and `.tsv` files open here automatically. Props such as `pageSize` are passed on.

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} pageSize={50} />;
```

## Good to know

- **Everything is text:** cells are shown as they are in the file; nothing is turned into dates or numbers.
- **Ragged rows:** a row with fewer cells than the widest row is filled with empty cells.
- **Encoding:** text is read as UTF-8, and a byte order mark is ignored.
- **Quoted cells:** cells in double quotes can hold the delimiter, line breaks and `""` for a quote.

## Accessibility

- The table sits in a scrollable region named by `label`, which can be reached and scrolled with the keyboard. Give each viewer a clear label when a page shows more than one.
- Column headers are real header cells; sortable ones are buttons, and the current order is announced.
- A loading message and any error are announced.

## License

MIT
