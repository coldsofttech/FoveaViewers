# Design: vanilla JS and Web Component entry points

Status: **Phase 0, for approval.** Nothing here changes a published API yet. The spikes in
[spikes/phase0](spikes/phase0/run.mjs) back the decisions below; their results are in
[Spike results](#spike-results).

## Goal

Let people who do not use React open files with the same viewers, without a breaking change for
the people who do.

- React users change nothing: `@coldsofttech/fovea-markdown` still exports `MarkdownViewer`.
- Everyone else gets `/vanilla` (a plain function) and `/element` (a Web Component) from the same
  package.
- Each viewer has **one implementation** of its rendering. React becomes a thin wrapper over it
  (see [Converging React](#converging-react-on-the-controllers)).

Not goals: a rewrite of the parsing code (it is already framework-free), a new look, new viewer
features, server-side rendering.

## Entry points

Every viewer package, and the shared package, gain two subpaths. The root stays as it is.

| Entry                                    | For                      | Exports                                               |
| ---------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `@coldsofttech/fovea-markdown`           | React (**unchanged**)    | `MarkdownViewer`                                      |
| `@coldsofttech/fovea-markdown/vanilla`   | plain JS, Vue, Svelte, … | `createMarkdownViewer`                                |
| `@coldsofttech/fovea-markdown/element`   | HTML, any framework      | registers `<fovea-markdown>`; `defineMarkdownElement` |
| `@coldsofttech/fovea-markdown/style.css` | light-DOM users          | unchanged                                             |

The shared package follows the same shape:

| Entry                                      | Exports                                                   |
| ------------------------------------------ | --------------------------------------------------------- |
| `@coldsofttech/fovea-viewers`              | React `Viewer`, `registry`, `resolve`, `load` (unchanged) |
| `@coldsofttech/fovea-viewers/vanilla`      | `createViewer` (auto-detect, lazy load)                   |
| `@coldsofttech/fovea-viewers/element`      | registers `<fovea-viewer>`; `defineViewerElement`         |
| `@coldsofttech/fovea-viewers/core`         | unchanged (React-based helpers)                           |
| `@coldsofttech/fovea-viewers/core/vanilla` | React-free runtime the controllers share (new)            |
| `@coldsofttech/fovea-viewers/core/element` | `defineViewerElement` helper the elements share (new)     |

Naming: `/vanilla` rather than `/native`, because "native" reads as React Native. `/element`
rather than `/web-components`, because it is shorter and each package registers one element.

### `package.json` changes (per viewer package)

```jsonc
{
  "sideEffects": ["**/*.css", "./dist/element.js"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./vanilla": { "types": "./dist/vanilla.d.ts", "import": "./dist/vanilla.js" },
    "./element": { "types": "./dist/element.d.ts", "import": "./dist/element.js" },
    "./style.css": "./dist/style.css",
  },
  "peerDependencies": {
    "@coldsofttech/fovea-viewers": "^0.1.0",
    "react": "^18 || ^19",
    "react-dom": "^18 || ^19",
  },
  "peerDependenciesMeta": { "react": { "optional": true }, "react-dom": { "optional": true } },
}
```

- **React becomes an optional peer.** React users already have it; vanilla users get no peer
  warning. Only the root entry imports React.
- **`/element` has a side effect** (it registers a custom element), so it is listed in
  `sideEffects`; otherwise a bundler may drop a bare `import '…/element'`. It also exports
  `defineXElement(tag = 'fovea-x')` for explicit, renamed or late registration. Registering is
  idempotent: a tag that is already defined is left alone.
- **Registry.** Each entry gets a second literal `import()` so bundlers still split a chunk per
  viewer and per entry kind:
  ```js
  { id: 'markdown', …, load: () => import('@coldsofttech/fovea-markdown'),
    loadVanilla: () => import('@coldsofttech/fovea-markdown/vanilla') }
  ```
  The "install it with `npm install …`" hint stays for both.
- **Version.** Purely additive, so a minor bump (0.2.0).

## The controller contract

Every viewer has one factory with this shape:

```ts
type ViewerController<Props> = {
  /** The element the viewer draws into: a child of `container`, created by the controller. */
  readonly element: HTMLElement;
  /** Applies changed props. Only the props given change; the others keep their value. */
  update(next: Partial<Props>): void;
  /** Stops loading, removes everything the controller added and releases listeners. */
  destroy(): void;
};

declare function createMarkdownViewer(
  container: HTMLElement | ShadowRoot,
  props: MarkdownViewerProps,
): ViewerController<MarkdownViewerProps>;
```

Rules, so React, the element and plain callers all get the same behaviour:

1. **Props are the React props.** Same names, same meaning, same defaults. `source`, `fetcher`,
   `theme`, `label`, `onReady`, `onError` on every viewer, plus the viewer's own. No prop exists
   only in one entry point.
2. **Ownership.** The controller appends one root element to `container` and touches nothing else:
   never siblings, never `document.body`, never global state. `destroy()` removes that root.
3. **Container may be a shadow root.** The element entry hands the controller its shadow root.
   So controllers use `container.ownerDocument`, never `document.getElementById` or
   `document.querySelector`, and make ids from a per-instance counter.
4. **Idempotent lifecycle.** `destroy()` twice is fine. `update()` after `destroy()` is a no-op.
   Neither throws.
5. **`update` semantics.** Each viewer declares which props force a reload (at least `source`
   and `fetcher`) and which only re-apply (`theme`, `target`, `label`, …). A re-apply never
   reloads or loses scroll position. Setting a prop to its current value does nothing.
6. **Loading is cancellable.** A new `source` aborts the previous load; a result from a stale load
   is dropped, never shown, and never reported through a callback.
7. **Callbacks.** Always the latest passed (the equivalent of `useLatest`); replacing a callback
   with `update` never reloads. `onReady` fires once per successful load of a source. `onError`
   fires once per failure; the viewer shows its own error message as it does today. Callbacks are
   never called after `destroy()`.
8. **Errors.** Problems with the file go to `onError`. A call that is wrong (no container, no
   `source`) throws `TypeError` from the factory. `update` and `destroy` do not throw.
9. **Sizing.** The root fills the height of its container, as the React viewers do.
10. **No work at import.** Importing an entry touches no DOM and no `window`. Work starts when a
    factory runs or an element connects. (Keeps imports safe in SSR frameworks; rendering is still
    client-only.)

## Web Component mapping

Tag names: `fovea-viewer` for the shared package; `fovea-<id>` for each viewer
(`fovea-markdown`, `fovea-pdf`, …).

| Prop kind                                             | Attribute            | Property                  | Notes                                         |
| ----------------------------------------------------- | -------------------- | ------------------------- | --------------------------------------------- |
| string / number (`label`, `fit`, `password`)          | yes                  | yes                       | attribute reflects to property                |
| boolean (`allow-images`)                              | yes (presence)       | yes                       | absent means `false` (the React default)      |
| `source`                                              | string URL via `src` | yes (any `ViewerSource`)  | `File`/`Blob`/`ArrayBuffer` need the property |
| `theme`                                               | `light`/`dark`       | yes (also a token object) |                                               |
| objects and functions (`fetcher`, `target`, `colors`) | no                   | yes                       | not representable as attributes               |
| callbacks                                             | no                   | no                        | become events (below)                         |

Attributes are kebab-case of the prop (`allowImages` → `allow-images`, `source` → `src`).

**Events** replace callbacks. They are `CustomEvent`s that bubble and are composed, with the
callback's argument in `detail`:

| Callback                       | Event                                | `detail`               |
| ------------------------------ | ------------------------------------ | ---------------------- |
| `onReady`                      | `fovea-ready`                        | the `onReady` argument |
| `onError`                      | `fovea-error`                        | the `Error`            |
| `onMarked`                     | `fovea-marked`                       | `boolean \| null`      |
| `onLocated`, `onPageChange`, … | `fovea-located`, `fovea-page-change` | the argument           |
| `onNavigate`                   | `fovea-navigate`                     | `{ href, event }`      |

`fovea-navigate` is **cancelable**. In React, passing `onNavigate` stops the link opening; for the
element, calling `preventDefault()` does the same, and with no listener the default applies.

**Lifecycle.** `connectedCallback` creates the controller; `disconnectedCallback` destroys it. A
moved element is therefore re-created (state such as scroll position is lost): the same as
unmounting and remounting a React component. Properties and attributes set before connection are
buffered and applied on creation.

**Shadow DOM.** Open, attached by the element. Decisions (see the spikes):

- The element passes its shadow root to the controller, so viewer styles and viewer DOM are
  isolated from the page in both directions.
- `--fovea-*` theme tokens set on the host, or on any ancestor, reach the viewer, so `theme` and
  page-level theming keep working.
- CSS is delivered **inside** the element entry (below), so the user imports no stylesheet.

### One helper builds every element

Each element file is a declaration, not code:

```js
// fovea-markdown/src/element.js
import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createMarkdownViewer } from './vanilla.js';

export const defineMarkdownElement = defineViewerElement({
  tag: 'fovea-markdown',
  create: createMarkdownViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    'allow-images': ['allowImages', 'boolean'],
  },
  events: {
    onReady: 'fovea-ready',
    onError: 'fovea-error',
    onMarked: 'fovea-marked',
    onNavigate: 'fovea-navigate',
  },
});
defineMarkdownElement();
```

The helper owns the lifecycle, buffering, attribute reflection, `adoptedStyleSheets` with a
`<style>` fallback, and event dispatch, so the rules are written and tested once.

## Styles

The controllers reuse the **same CSS modules** as the React components, so the two cannot drift
and no class names are invented.

- **Light DOM (vanilla):** the user imports `…/style.css`, exactly as React users do now.
- **Shadow DOM (element):** a document-level stylesheet does not reach a shadow root (the spike
  confirms it), so the build also emits `dist/style.css.js`, whose default export is the CSS text.
  The element adopts it with `CSSStyleSheet.replaceSync` into `shadowRoot.adoptedStyleSheets`; one
  parsed sheet is shared by every instance. Where `adoptedStyleSheets` does not exist (jsdom, old
  browsers), the helper appends a `<style>` element instead.
- The `emit-css-as-module` plugin is about 15 lines (see `run.mjs`). It goes into `scripts/` and
  every package's `vite.config.js` uses it in Phase 1. It must run after Vite writes `style.css`
  (`enforce: 'post'`, `generateBundle` with `order: 'post'`).

## Shared runtime: `core/vanilla`

The React-free counterpart of `core`. Most of it already exists as plain functions inside the
React files.

| Export                                 | Replaces / reuses                                         |
| -------------------------------------- | --------------------------------------------------------- |
| `loadSource(source, opts)`             | `readSource` (already React-free)                         |
| `loadText(source, opts)`               | `useText`: `readSource` then `blob.text()`                |
| `applyTheme(el, theme)`                | `themeVars`, `lightTheme`, `darkTheme` (React-free)       |
| `markIn`, `clearMarks`, `bestMatch`, … | the existing modules, re-exported                         |
| `h(tag, attrs, …children)`             | small DOM builder; no `innerHTML` (the repo lints for it) |
| `prepareHtml`                          | existing, re-exported                                     |
| `createHtmlFrame`                      | vanilla version of `HtmlFrame.jsx`                        |
| `createGrid`                           | vanilla version of `Grid.jsx`                             |

`core` (React) keeps its exports. Its hooks are rewritten over the vanilla functions during
convergence, with no change for callers.

## Converging React on the controllers

Once a viewer's controller passes the conformance suite, its React component becomes:

```jsx
export function MarkdownViewer(props) {
  const host = useRef(null);
  const controller = useRef(null);
  useEffect(() => {
    controller.current = createMarkdownViewer(host.current, props);
    return () => controller.current.destroy();
  }, []); // create once (StrictMode: create, destroy, create)
  useEffect(() => controller.current?.update(props)); // controller ignores unchanged values
  return <div ref={host} style={{ height: '100%' }} />;
}
```

This is per viewer and only when the existing React tests and the conformance suite both pass, so
it can stop at any point without hurting anyone. The public React API does not change.

**Conformance suite.** One list of behaviours per viewer (loads a Blob, URL and ArrayBuffer; shows
an error and calls `onError`; ignores a stale source; marks and scrolls to `target`; applies a
`theme`; `destroy` leaves no node and no pending callback; `update` after `destroy` is a no-op; …)
runs through three adapters, `mount(props) → { update, destroy, root }`: the controller directly,
the React wrapper, and the element. The existing React tests are the starting point. `vitest-axe`
runs on the output of all three.

## Build and CI changes

- Multi-entry Vite lib builds per package (`index`, `vanilla`, `element`), with the existing
  `preserveModules`. Spike: entries share one `pdfjs.js` and one emitted worker.
- `check-no-react.js` keeps its job (React is never bundled) and gains a second check: the
  `vanilla`, `element` and `core/vanilla` entries must not import `react`, `react-dom` or
  `@coldsofttech/fovea-viewers/core` (the React one), directly or through a shared chunk.
- `check-pack.js`, `publint` and `attw` cover the new entries and their `.d.ts`.
- `.size-limit.json` gets an entry per new entry point.
- `eslint`: `no-unsanitized` stays on for the controllers; `document.getElementById`,
  `document.querySelector` and bare `document.activeElement` are banned in controller code (rule 3).
- The smoke test gains a React-free app that uses `/vanilla` and `/element`.

## Spike results

Run with `node docs/design/spikes/phase0/run.mjs` after `npm run build` (Chromium via Playwright,
which is not a repository dependency). All 12 pass.

| Question                                                           | Result                                                                                                       | What it means                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `markIn` / `clearMarks` inside a shadow root                       | works, with an element or the `ShadowRoot` as `root`; marks split across elements; nothing leaks to the page | `mark.js` needs no change                                                      |
| Theme tokens across the boundary                                   | `--fovea-*` set on the host reach the viewer                                                                 | `theme` and page theming work                                                  |
| Page CSS leaking in                                                | it does not                                                                                                  | isolation is real                                                              |
| Real `MarkdownViewer` in a shadow root, styled by an adopted sheet | renders, `target` marked and scrolled                                                                        | the shadow-root approach works with the existing CSS modules                   |
| Same viewer with **no** adopted sheet                              | unstyled                                                                                                     | a `style.css` import cannot serve the element: confirms the CSS-as-module step |
| `HtmlViewer` (sandboxed iframe) in a shadow root                   | works; target marked inside the frame                                                                        | `HtmlFrame` needs no special case                                              |
| `PdfViewer` in a shadow root from a consumer's bundle              | worker resolves; page painted on a canvas                                                                    | the worker plumbing works for any consumer                                     |
| Second pdf entry in the lib build                                  | shares `pdfjs.js`; the worker is emitted once next to it; the entry has no `react`                           | the multi-entry layout is safe for pdf                                         |
| `style.css.js` emitted by a build plugin                           | works (needs `enforce: 'post'`)                                                                              | the CSS delivery plan holds                                                    |
| jsdom                                                              | `attachShadow` yes, `adoptedStyleSheets` no                                                                  | the `<style>` fallback is required for unit tests                              |

**Decision from the spikes: open Shadow DOM is the default for the element, with no fallback to
light DOM.** No spike was a no-go.

## Findings to carry into later phases

From a scan of the existing code for document-level assumptions:

- `fovea-excel/src/ExcelViewer.jsx:168` calls `document.getElementById(...).focus()` for the tab
  keyboard handling. That finds nothing inside a shadow root. The excel controller must look up the
  tab from its own root (or keep refs). Same applies to ids made by `useId`: use a per-instance
  counter.
- `EmailViewer.jsx:51` and `HtmlFrame.jsx:92,131` use `document.createElement` / `window.open` /
  `window.location`. All work in a shadow root; the controller should use `container.ownerDocument`.
- No viewer CSS uses `:root`, `body` or `@font-face`, which would not work inside a shadow root.
- Still to verify in the phase that touches it: focus and keyboard behaviour across the boundary
  (`delegatesFocus`, `document.activeElement` is retargeted to the host), and text selection in the
  PDF text layer.

## Decisions agreed so far

1. `/vanilla` and `/element` subpaths; React stays at the root (non-breaking).
2. Converge React onto the vanilla controllers, per viewer.
3. Element registration is both: import to register, plus an exported `defineXElement()`.
4. Per-viewer packages stay.
5. Open Shadow DOM for the element (from the spikes).

Next: Phase 1 (the `core/vanilla` runtime, the build plugin, the conformance harness and the CI
checks), then the text and image pilot.
