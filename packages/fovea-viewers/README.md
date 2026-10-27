# @coldsofttech/fovea-viewers

Finds the right Fovea viewer for a file and loads it when needed. Part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers).

> Work in progress. The text, Markdown, code, HTML, feed and table viewers are available so far.

## Install

```bash
npm install @coldsofttech/fovea-viewers
```

Then install the viewers you want, for example `@coldsofttech/fovea-text`. React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';
import '@coldsofttech/fovea-text/style.css';

<Viewer source={file} theme="dark" />;
```

`Viewer` works out which viewer fits `source` from its file name, URL or MIME type, loads that viewer, and passes it the rest of the props (`fetcher`, `theme`, `label`, `onReady`, `onError`). A `.log` file opens in the code viewer (coloured) unless you pass `type="text"`. If the file's type can't be told, for example for an `ArrayBuffer`, pass `type="text"`. If the viewer isn't installed, the error says which package to install and goes to `onError`.

## Also available

- `resolve(fileOrMimeOrName)` returns the viewer id for a file, MIME type, file name or URL, or `null`.
- `load(id)` loads a viewer package on demand.
- `@coldsofttech/fovea-viewers/core` provides the shared code the viewers use to read files and apply themes. It also exports `Grid`, an unstyled table with sortable headers and paging that the table viewer is built on (you pass `classNames` to style it), and `compareCells`, the ordering it sorts by.

## License

MIT
