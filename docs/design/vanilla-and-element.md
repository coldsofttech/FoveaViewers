# Design: vanilla JS and Web Component entry points

Status: **Phase 0 and 1 approved; Phase 2 (the text and image pilot) built**: see
[Phase 2: the pilot](#phase-2-the-pilot). The root of every package is still the React component
with the same props; the new entries so far are `core/vanilla` and `core/element` in
`@coldsofttech/fovea-viewers`, and `/vanilla` and `/element` in `@coldsofttech/fovea-text` and
`@coldsofttech/fovea-image`. The spikes in
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

| Prop kind                                             | Attribute            | Property                  | Notes                                                              |
| ----------------------------------------------------- | -------------------- | ------------------------- | ------------------------------------------------------------------ |
| string / number (`label`, `fit`, `password`)          | yes                  | yes                       | attribute reflects to property                                     |
| boolean (`allow-images`)                              | yes (presence)       | yes                       | absent leaves the viewer's default; the text `false` means `false` |
| `source`                                              | string URL via `src` | yes (any `ViewerSource`)  | `File`/`Blob`/`ArrayBuffer` need the property                      |
| `theme`                                               | `light`/`dark`       | yes (also a token object) |                                                                    |
| objects and functions (`fetcher`, `target`, `colors`) | no                   | yes                       | not representable as attributes                                    |
| callbacks                                             | no                   | no                        | become events (below)                                              |

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
import { createMarkdownViewer } from './vanilla/createMarkdownViewer.js';

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
  confirms it), so the element carries its own CSS: its entry imports `./style.css.js`, whose
  default export is the CSS text. The element adopts it with `CSSStyleSheet.replaceSync` into
  `shadowRoot.adoptedStyleSheets`; one parsed sheet is shared by every instance. Where
  `adoptedStyleSheets` does not exist (jsdom, old browsers), the helper appends a `<style>` element
  instead. The host is `display: block; height: 100%`, so like the React viewers it fills its
  parent; a page can override that with its own rule for the tag.
- **How `style.css.js` gets its text.** The package has a stub `src/style.css.js`
  (`export default '';`) so the source, its tests and its types work. In a build, the
  `scripts/vite-plugin-css-module.js` plugin swaps the stub's export for a placeholder and, once
  Vite has written `style.css`, replaces the placeholder with the real text (tested in
  `scripts/vite-plugin-css-module.test.js`). It must run after Vite writes `style.css`
  (`enforce: 'post'`, `generateBundle` with `order: 'post'`), and it fails the build if there is no
  stylesheet or nothing imports the stub. This replaced the Phase 1 design, which emitted a separate
  `style.css.js` file that the source could not import.

## Shared runtime: `core/vanilla` and `core/element`

The React-free counterpart of `core`, built in Phase 1 (`packages/fovea-viewers/src/core/vanilla`
and `…/element`). Most of it already existed as plain functions inside the React files.

| Export (`core/vanilla`)                | What it is                                                         |
| -------------------------------------- | ------------------------------------------------------------------ |
| `createShell(container, props, opts)`  | the contract's rules in one place (below)                          |
| `loadSource(source, opts)`             | `readSource`, which was already React-free                         |
| `loadText(source, opts)`               | `readSource` then `blob.text()`: what `useText` does               |
| `applyTheme(el, theme)`                | sets `--fovea-*` on the root and clears tokens a later theme drops |
| `createH(doc)`                         | `h(tag, attrs, …children)`: builds elements, never parses markup   |
| `markIn`, `clearMarks`, `bestMatch`, … | the existing modules, re-exported                                  |
| `themeVars`, `lightTheme`, `darkTheme` | re-exported                                                        |
| `prepareHtml`                          | re-exported                                                        |

| Export (`core/element`)     | What it is                                                       |
| --------------------------- | ---------------------------------------------------------------- |
| `defineViewerElement(spec)` | returns `define(tag?)`, which registers a viewer's Web Component |

**Deferred from the plan:** `createHtmlFrame` and `createGrid` (vanilla versions of `HtmlFrame.jsx`
and `Grid.jsx`) are not built yet. They are large, and the first viewers that need them are html,
email and table (Phase 3) and excel (Phase 4); building them against a real viewer is safer than
building them in isolation.

`core` (React) keeps its exports and is untouched. Its hooks are rewritten over the vanilla
functions during convergence, with no change for callers.

### `createShell`

Every controller starts with one. It implements the contract once, so a viewer's own code is only
what is specific to it:

```js
const shell = createShell(container, props, { className: styles.root });
shell.root; // the one element added to the container (has data-fovea-root)
shell.h; // createH(container.ownerDocument)
shell.props; // current props
shell.onUpdate((changed, props) => {
  /* react to the names in `changed` */
});
shell.load(task, { onResult, onError }); // cancellable; stale results never reach the handlers
shell.emit('onReady', info); // calls the latest callback; nothing after destroy
shell.cleanup(fn); // runs on destroy, newest first
return shell.api; // { element, update, destroy }
```

- `update` ignores values equal to the current ones and calls the handler with only the names that
  changed. After `destroy` it does nothing.
- `load` starts a new load by aborting the previous one. A result from an aborted or destroyed load
  is dropped. The task receives an `AbortSignal`.
- A callback that throws is reported with `reportError` (or rethrown from a timer) and does not
  break the viewer.
- The root carries a `data-fovea-root` attribute. The conformance adapters use it to find the
  viewer's root, and it is a stable hook for tests and page styles.

### `defineViewerElement`

Builds the class lazily (so importing it in a server render is safe and returns `null` where there
are no custom elements). It implements the mapping rules above, plus:

- the viewer is created only when the element is connected **and** has its required props
  (default `['source']`), so `createElement` then `el.source = file` works;
- `events` values are a name or `{ name, cancelable, detail, fallback }`; `fallback` runs when the
  event was cancelable and nobody called `preventDefault()`. It is how `fovea-navigate` keeps the
  React behaviour: with no listener the viewer's default applies;
- a tag that is already defined is left alone, so registering twice is safe.

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
runs through three adapters, `mount(props, { host }) → { update, destroy, root }`: the controller
directly, the React wrapper, and the element. The existing React tests are the starting point.
`vitest-axe` runs on the output of all three.

Built in Phase 1 in `test-support/` (not published): `conformance.js` (`describeConformance`),
`adapters.jsx` (`vanillaAdapter`, `elementAdapter`, `reactAdapter`) and `stub-viewer.js`, a viewer
made only of the shared runtime. The suite currently has 11 behaviours per adapter (a Blob, an
ArrayBuffer and a URL load; a failed load reports through `onError`; a newer source wins over a
slower older one; unchanged props or a replaced callback do not reload; a theme applies and
clears; a result after `destroy` is dropped; `destroy` twice and `update` after it are safe;
siblings are left alone; no accessibility violations), plus one that vanilla controllers run:
drawing into a shadow root. A viewer adds its own checks (marking, scrolling, paging) beside it.
I broke the stale-load guard on purpose to confirm the suite fails when it should.

## Build and CI changes

Status after Phase 1 in brackets.

- Multi-entry Vite lib builds per package (`index`, `vanilla`, `element`), with the existing
  `preserveModules`. Spike: entries share one `pdfjs.js` and one emitted worker. [`fovea-viewers`
  builds `core/vanilla` and `core/element`; text and image build `vanilla/index` and `element`; the
  other packages follow in Phase 3 and 4.]
- `scripts/check-vanilla-no-react.js` follows every import from the `./vanilla`, `./element`,
  `./core/vanilla` and `./core/element` entries through the built files and fails if one reaches
  `react`, `react-dom`, `@coldsofttech/fovea-viewers` or `@coldsofttech/fovea-viewers/core`
  (the React ones), directly or through a shared chunk. It is in `check:packages` for
  `fovea-viewers`, and each viewer package adds it when it gets those entries. A package with none
  of the entries passes. `check-no-react.js` keeps its job (React is never bundled). [done]
- `check-pack.js`, `publint` and `attw` cover the new entries and their `.d.ts`. [done for
  `fovea-viewers`]
- `.size-limit.json` has an entry per new entry point. [done: `core/vanilla` 14 kB (13.0 kB, mostly
  DOMPurify through `prepareHtml`), `core/element` 1.5 kB (0.9 kB)]
- ESLint, for `core/vanilla`, `core/element` and later each package's `vanilla.js`, `vanilla/` and
  `element.js`: `document` is a restricted global (use `container.ownerDocument`, rule 3), and
  `react`, `react-dom`, the React entry points of the shared package and its React-only modules
  (`*.jsx`, `useSource`, `useText`, `useLatest`) cannot be imported. `no-unsanitized` stays on.
  [done, and checked against a probe file]
- React is an optional peer of `@coldsofttech/fovea-viewers`. [done] Each viewer package follows
  when it gets its `/vanilla` entry.
- Vitest has a `scripts` project for the build scripts' own tests. [done]
- The smoke test gains `smoke-vanilla.test.js`, which uses the packed text and image packages
  through `/vanilla` and `/element` with no React rendering. [done]

## Phase 2: the pilot

Text and image, on all three entry points, with the React components converged onto the
controllers.

**What was built**

| In                   | What                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `fovea-text`         | `createTextViewer`, `createLineViewer` (`/vanilla`); `<fovea-text>` (`/element`); `TextViewer` and `LineViewer` are now wrappers |
| `fovea-image`        | `createImageViewer` (`/vanilla`); `<fovea-image>` (`/element`); `ImageViewer` is now a wrapper                                   |
| `fovea-viewers/core` | `useController(create, props)`: the React side of a wrapper (create once, `update` each render, `destroy` on unmount)            |
| `examples/vanilla`   | an app with no React that uses both viewers, as functions and as elements                                                        |

- **How a wrapper looks.** `const host = useController(createTextViewer, props); return <div ref={host} style={{ height: '100%' }} />;`
  That is the whole component. Props go to `update` after every render; the controller ignores the
  ones that did not change (compared with `Object.is`, so an inline object or function reads as
  changed on each render, as it did before when it was a dependency of a memo).
- **`LineViewer` and `TextViewer` share `createLineView`**, which draws into a root the caller
  owns. Rows are kept by line index; scrolling adds and drops only the lines at the edges and keeps
  the DOM in line order, so text selection and screen-reader order survive scrolling.
- **The existing React tests were the spec.** All 19 text tests and 9 image tests, written against
  the old React components, pass unchanged against the wrappers, as do the code viewer's, which
  builds on `LineViewer`.
- **The conformance suite** runs for each viewer through three adapters (controller, element, React
  component) with a `settle` hook for what jsdom cannot do, such as firing `load` on an image.
- **Real-browser check.** `docs/design/spikes/phase2/verify.mjs` builds `examples/vanilla` and a
  small React app, opens them in Chromium and drives the built packages: 22 checks, all pass. They
  include a 50 000 line file (about 100 rows in the page), scroll-to-target and marking, CSS inside
  the shadow root, themes from page-level custom properties, destroy on removal, no errors in the
  console, and a scan showing the React-free app ships no React.

**What the pilot changed in the design**

1. **The element host needs a height.** The first real-browser run drew all 50 000 lines of a file
   in `<fovea-text>`: the host had no height, so the viewer's `height: 100%` resolved to its
   content. jsdom cannot show this (it has no layout). The host is now `height: 100%`, like the
   React viewers, and the README says to give the parent a height. The same trap exists for the React
   components, as before.
2. **`style.css.js` is a stub the build fills in** (see Styles), not a file the build emits.
3. **A boolean attribute with the text `false` is `false`**, so a prop that is on by default
   (`show-info`) can be turned off in markup.
4. **`fit` on the image** applies until the image has loaded or the reader has zoomed, as it did in
   React (where it was only read when a new image started). Changing it later is ignored.
5. **Failed pictures are removed** from the page, as React unmounted them, so the browser's
   broken-image mark does not show. Found by the existing React test.
6. **The lockfile.** Phase 1 changed `peerDependenciesMeta` without updating `package-lock.json`;
   this phase's `npm install` corrected that along with adding the new workspace.

**Noticed, not changed**

- `sample.log` is referenced by `scripts/smoke/smoke.test.jsx` and the demo but is not in
  `examples/demo/public/samples`, so `npm run smoke` fails on `opens sample.log` on `main` too. It
  is not in CI.
- A root-level `tsc -p jsconfig.json` reports many type errors, mostly in tests and the demo, before
  and after this work. Each package's own `build:types` is clean.

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

Next: Phase 3, the shared `createViewer` and `<fovea-viewer>` (registry gets `loadVanilla`), then
markdown, table, code, feed, html and email, including the vanilla `HtmlFrame` and `Grid`.
