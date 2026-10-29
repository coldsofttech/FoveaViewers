# @coldsofttech/fovea-excel

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-excel)](https://www.npmjs.com/package/@coldsofttech/fovea-excel)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

An Excel workbook viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens `.xlsx` and `.xlsm` files from a URL, a `File` or `Blob`, or raw bytes. Macros are never run.
- A tab for each sheet, which works with the keyboard. Hidden sheets are not shown.
- Keeps how the sheet looks: bold, italic and underlined text, text and fill colours, alignment, borders, merged cells and column widths.
- Shows numbers, percentages, currencies and dates the way the file formats them.
- Shows the value a formula works out, or the formula itself when you ask.
- Sorts by column and shows rows a page at a time.
- Finds words anywhere in the workbook, shows their sheet and page and marks them, for example to show a search result.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-excel @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { ExcelViewer } from '@coldsofttech/fovea-excel';
import '@coldsofttech/fovea-excel/style.css';

<div style={{ height: 500 }}>
  <ExcelViewer source={file} />
</div>;
```

The viewer fills the height of its parent, so give the parent a height. The reading code is loaded the first time a workbook is opened, so a page that never shows one never pays for it.

## Props

| Prop            | Description                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `source`        | The workbook: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                                     |
| `fetcher`       | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                         |
| `theme`         | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's colours.                                    |
| `label`         | The accessible name of the sheet tabs. Defaults to `Workbook`.                                                           |
| `sheet`         | The sheet to show, by name or place (from 0). When given, you decide the sheet.                                          |
| `onSheetChange` | Called with `(name, index)` when a sheet tab is chosen.                                                                  |
| `showFormulas`  | Show a formula as written, for example `=A1+B1`, instead of its value. Off by default.                                   |
| `sortable`      | Let a column letter be pressed to sort. Defaults to `true`, and is off for a sheet with merged cells.                    |
| `pageSize`      | How many rows are shown at once. Defaults to 100.                                                                        |
| `target`        | `{ matched, before?, after? }`: words to find in the workbook. Their sheet and page are shown and the words marked.      |
| `onMarked`      | Called with `true` when the target's words were marked, `false` when they are not in the workbook, `null` for no target. |
| `onReady`       | Called with `{ sheets }`, the sheet names, once the workbook is shown.                                                   |
| `onError`       | Called with an `Error` when the file cannot be loaded or read. The viewer also shows the message.                        |

## Examples

### Show formulas

```jsx
<ExcelViewer source={file} showFormulas />
```

### Choose the sheet yourself

```jsx
const [name, setName] = useState('Sales');

<ExcelViewer source={file} sheet={name} onSheetChange={setName} />;
```

### Show a search result

```jsx
<ExcelViewer
  source={file}
  target={{ matched: 'Cherries' }}
  onMarked={(found) => console.log(found)}
/>
```

### Open any file with `Viewer`

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} />;
```

## Good to know

- Rows are named by column letters (A, B, C), as in Excel, and the first row is shown like any other row.
- Sorting is turned off for a sheet with merged cells, because sorted rows would break the merges.
- Dates show as `2024-10-01`, with the time when there is one. Other date formats are not reproduced.
- Colours that come from the workbook's theme (rather than a fixed colour) are not applied.
- Pictures, charts and conditional formatting in the workbook are not shown.
- Only `.xlsx` and `.xlsm` are supported, not the older `.xls`.

## Accessibility

The sheets are a tab list that works with the arrow keys, Home and End. Each sheet is a table with column headers, and the scrolling area can be focused so the keyboard can scroll it.

## License

MIT
