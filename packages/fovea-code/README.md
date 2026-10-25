# @coldsofttech/fovea-code

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-code)](https://www.npmjs.com/package/@coldsofttech/fovea-code)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A source code viewer for React, as Visual Studio Code would show it. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens a file from a URL, a `File` or `Blob`, or raw bytes.
- Line numbers and the colours of VS Code's Light+ and Dark+ themes.
- Colours 26 kinds of file, from JavaScript to Python, C++, JSON, YAML, SQL and logs. See the list below.
- Only the lines in view are drawn, so very large files open at once.
- Lays out minified CSS, JavaScript, JSON and XML, and does it by itself for a file with a very long line.
- Finds words in the code and marks them on their line, for example to show a search result.
- Works out the language from the file name, or you can say which it is.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-code @coldsofttech/fovea-text @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app. The code viewer draws with the text viewer, so it needs its style sheet.

## Use

```jsx
import { CodeViewer } from '@coldsofttech/fovea-code';
import '@coldsofttech/fovea-text/style.css';

<div style={{ height: 500 }}>
  <CodeViewer source={file} theme="dark" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Props

| Prop         | Description                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`     | The file: a URL string, a `File` or `Blob`, or an `ArrayBuffer`. Text is read as UTF-8.                                                            |
| `fetcher`    | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                                                   |
| `language`   | A key from the table below, such as `py` or `json`. Worked out from the file name or URL when left out. A file of unknown language is shown plain. |
| `mode`       | `'auto'` (the default), `'source'` or `'formatted'`. See below.                                                                                    |
| `match`      | `{ before?, matched?, after? }`: words to find in the code and mark.                                                                               |
| `theme`      | `'light'` (the default), `'dark'`, or an object of colours laid over the light theme.                                                              |
| `label`      | The accessible name. Defaults to the language, for example `JSON source`.                                                                          |
| `lineHeight` | Height of every line in pixels. Defaults to 20.                                                                                                    |
| `onLocated`  | Called with `{ line, column, offset, end }` where the match is (lines from 1), or `null` when it is not there.                                     |
| `onReady`    | Called with `{ lineCount, language, mode, canFormat, tooBig }` once the code is shown.                                                             |
| `onError`    | Called with an `Error` when the file cannot be loaded. The viewer also shows the message.                                                          |

## Languages

| Key      | Language         | File extensions            |
| -------- | ---------------- | -------------------------- |
| `js`     | JavaScript       | js, mjs, cjs               |
| `ts`     | TypeScript       | ts, mts, cts               |
| `jsx`    | JSX              | jsx                        |
| `tsx`    | TSX              | tsx                        |
| `json`   | JSON             | json, jsonc, geojson       |
| `ndjson` | NDJSON           | ndjson, jsonl              |
| `ipynb`  | Notebook         | ipynb                      |
| `css`    | CSS              | css                        |
| `xml`    | XML              | xml, xsd, xsl, xslt, plist |
| `yaml`   | YAML             | yaml, yml                  |
| `toml`   | TOML             | toml                       |
| `ini`    | INI              | ini, cfg                   |
| `sql`    | SQL              | sql                        |
| `rst`    | reStructuredText | rst                        |
| `log`    | Log              | log                        |
| `c`      | C                | c, h                       |
| `cpp`    | C++              | cpp, cc, cxx, hpp, hh, hxx |
| `cs`     | C#               | cs                         |
| `java`   | Java             | java                       |
| `go`     | Go               | go                         |
| `rs`     | Rust             | rs                         |
| `py`     | Python           | py, pyw                    |
| `php`    | PHP              | php                        |
| `rb`     | Ruby             | rb                         |
| `sh`     | Shell            | sh, bash, zsh              |
| `ps1`    | PowerShell       | ps1, psm1                  |

HTML has its own viewer, `@coldsofttech/fovea-html`.

## Examples

### Minified files

With `mode="auto"` a file that has a line longer than 2,000 characters opens laid out, if its language can be laid out (CSS, JavaScript, JSON and XML). Pass `mode="source"` to show it as it is, or `mode="formatted"` to lay it out. `onReady` tells you which was used, so you can offer a switch:

```jsx
const [mode, setMode] = useState('auto');
const [info, setInfo] = useState(null);

<>
  {info?.canFormat && (
    <button onClick={() => setMode(info.mode === 'formatted' ? 'source' : 'formatted')}>
      {info.mode === 'formatted' ? 'Show the source' : 'Lay out'}
    </button>
  )}
  <CodeViewer source={file} mode={mode} onReady={setInfo} />
</>;
```

Files bigger than 20 MB are never laid out, and a single line longer than 20,000 characters is cut short and left uncoloured. `tooBig` in `onReady` says when that applied.

### Show a search result

`matched` is the text found, and `before` and `after` help pick the right place when it appears more than once. For a file that was turned into `key: value` lines, the key before the words is used to find them.

```jsx
<CodeViewer
  source={file}
  match={{ before: '"name": "', matched: 'wheat', after: '"' }}
  onLocated={(where) => where && console.log(`line ${where.line}, column ${where.column}`)}
/>
```

### Choose the language

```jsx
<CodeViewer source={arrayBuffer} language="py" />
```

An `ArrayBuffer` or `Blob` has no name, so say the language yourself.

### Custom colours

Pass an object to `theme`. Each key becomes a CSS variable named `--fovea-<key>`, laid over the light theme. Besides `background`, `foreground`, `muted`, `border`, `gutter-background`, `current-line`, `hit-background` and `hit-outline`, the keys `token-comment`, `token-string`, `token-number`, `token-keyword`, `token-function`, `token-storage`, `token-constant` and others colour the code. The full set is in `codeTheme('light')`.

```jsx
import { CodeViewer, codeTheme } from '@coldsofttech/fovea-code';

<CodeViewer source={file} theme={{ ...codeTheme('dark'), 'token-keyword': '#ff7b72' }} />;
```

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so code files open here automatically. A `.log` file also opens here, in colour. To see a log as plain text, use `type="text"`:

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} theme="dark" />;
<Viewer source={logFile} type="text" />;
```

## Good to know

- **Light by default:** code is coloured to suit a background, so with no `theme` it uses the light theme. Pass `theme="dark"` on a dark page.
- **Not a full parser:** the colouring is done line by line, as VS Code's simple grammars do, so unusual code can be coloured imperfectly. It never changes the text.
- **Encoding:** text is read as UTF-8. Line breaks (`\n`, `\r\n` and `\r`) are all shown as line breaks.
- **Copying:** only the lines that are drawn can be selected and copied. Line numbers are never copied.
- **Memory:** the whole file is read into memory once.
- **No wrapping:** a long line scrolls sideways.

## Accessibility

- The viewer is a labelled region that takes keyboard focus, so arrow keys, Page Up, Page Down, Home and End scroll it.
- Screen readers read the text of each line. Line numbers are hidden from them.
- Colours follow VS Code's themes. Do not rely on colour alone to tell code apart.
- Give each viewer a clear `label` when a page shows more than one.

## License

MIT
