# Fovea Viewers without React

The same viewers as the React demo, used from plain JavaScript and as Web Components. There is no React in this app.

```bash
npm run build          # from the repository root: builds the packages first
npm run dev -w vanilla-demo
```

Each viewer package has two entry points besides the React one:

- `@coldsofttech/fovea-text/element` registers `<fovea-text>`. Set `src`, `theme`, `label` as attributes, or `source` (a `File`, `Blob` or `ArrayBuffer`) and `fetcher` as properties. It dispatches `fovea-ready` and `fovea-error`.
- `@coldsofttech/fovea-text/vanilla` exports `createTextViewer(container, props)`, which returns `{ element, update, destroy }`. Import `@coldsofttech/fovea-text/style.css` with it.

See `src/main.js`.
