# @coldsofttech/fovea-viewers

Finds the right Fovea viewer for a file and loads it when needed. Part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers).

> Work in progress. The viewer components are not implemented yet.

## Install

```bash
npm install @coldsofttech/fovea-viewers
```

Then install the viewers you want, for example `@coldsofttech/fovea-markdown`. React and `react-dom` 18 or 19 must be installed in your app.

## What it does

- Picks a viewer from a file, MIME type, file name or URL.
- Loads a viewer on demand, with a clear message when it isn't installed.
- Provides the shared code the viewers use to read files, available from `@coldsofttech/fovea-viewers/core`.

## License

MIT
