# Fovea Viewers without React

The same viewers as the React demo, used from plain JavaScript and as Web Components. There is no React in this app. It shows the text and image viewers directly, and twelve kinds of file (including PDF, Excel, Word and PowerPoint) through one `<fovea-viewer>` element each.

```bash
npm run build          # from the repository root: builds the packages first
npm run dev -w vanilla-demo
```

Each viewer package has two entry points besides the React one:

- `@coldsofttech/fovea-text/element` registers `<fovea-text>`. Set `src`, `theme`, `label` as attributes, or `source` (a `File`, `Blob` or `ArrayBuffer`) and `fetcher` as properties. It dispatches `fovea-ready` and `fovea-error`.
- `@coldsofttech/fovea-text/vanilla` exports `createTextViewer(container, props)`, which returns `{ element, update, destroy }`. Import `@coldsofttech/fovea-text/style.css` with it.

`@coldsofttech/fovea-viewers/element` registers `<fovea-viewer>`, which opens a file in the matching viewer and loads that viewer when it is needed. See `src/main.js`.
