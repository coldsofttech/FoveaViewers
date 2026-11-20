# Design: vanilla JS and Web Component entry points

Status: **built and verified (Phases 0 to 5).** Every viewer has `/vanilla`, `/element` and `/css`
entries next to the React component at the root, which keeps its props and behaviour and is now a
thin wrapper over the controller. `@coldsofttech/fovea-viewers` has `createViewer` and
`<fovea-viewer>`, which open all twelve kinds of file. The packages are at 0.2.0, ready to release.
This document records how it was designed and what each phase found; the final state is described
in the READMEs. The spikes in [spikes/phase0](spikes/phase0/run.mjs) back the early decisions; their
results are in [Spike results](#spike-results).

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

## Phase 3: the shared viewer and six more viewers

**What was built**

| In                                                              | What                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `fovea-viewers`                                                 | `createViewer` (`/vanilla`) and `<fovea-viewer>` (`/element`); the catalog split from the React loaders (below)   |
| `fovea-viewers/core`                                            | vanilla `createGrid` and `createHtmlFrame` (in `core/vanilla`); `Grid` and `HtmlFrame` are now wrappers over them |
| `fovea-markdown`, `-table`, `-code`, `-feed`, `-html`, `-email` | `/vanilla`, `/element` and `/css`; the React components are wrappers                                              |
| all eight converted                                             | each package exports its CSS text as `/css` (`dist/style.css.js`); the code viewer uses the text viewer's         |

**`createViewer` and the registry.** The React entry loads viewers through `registry.js`, whose
`import()` calls name the viewers' React roots. A vanilla app must never see those, or a bundler
would try to resolve React for it. So the registry is split: `catalog.js` holds what files each
viewer opens and the functions that pick one (no imports of viewers), `registry.js` adds the React
loaders (the same exports as before), and `vanilla/registry.js` has the `/vanilla` and `/css`
loaders for the eight viewers that have them. A viewer without a `/vanilla` entry gets a clear
error ("cannot be used without React yet") rather than a failed import.

**Styling a viewer inside a shadow root.** A viewer drawn by `createViewer` into a shadow root (the
`<fovea-viewer>` element's, or any other) needs its CSS there. `createViewer` loads the chosen
viewer's `/css` with it and adopts it into the shadow root, once for each root. Outside a shadow
root nothing is added: the page's own `style.css` imports do the work.

**`options`.** `<fovea-viewer>` cannot list every prop of every viewer as attributes, so it takes
the chosen viewer's own props in an `options` object (`{ target, allowImages, pageSize }`), merged
under the props `createViewer` has itself. A key that disappears from `options` goes back to the
viewer's default.

**Grid and HtmlFrame.** Both are controllers (`createGrid`, `createHtmlFrame`) that other
controllers hold inside their own root, which is how the table, html and email viewers use them.
Two details matter:

- The grid keeps its header and paging buttons in the page while the reader sorts and pages, so the
  button they pressed keeps the keyboard focus. The body is drawn again only when something it is
  made from changes: rows, the cells' styles and spans, or the page. This keeps what a host did to
  the cells (the Excel viewer marks words in them) across a render that changed nothing.
- The React `Grid` and `HtmlFrame` render a `div` with `display: contents`, so the grid and the
  frame sit where their parent's layout expects them.

**`useController` grew two rules**, both found by existing tests failing:

1. A prop that is no longer given is treated as `undefined`. (`rerender(<HtmlViewer ... />)` without
   `target` must clear the mark.)
2. A clean-up with the element still in the page is StrictMode's, so the controller is kept for the
   effect that follows it instead of being destroyed and made again. A real unmount (the element
   already out of the page) destroys at once. This stopped the Excel viewer losing its marks in
   StrictMode and also stops a file being loaded twice there.

**The element helper** passes the element to a `fallback` (`fallback(host, ...args)`), so a viewer can
read its own props when nobody cancelled an event. The html viewer's fallback is what `links` says:
`window` opens a new window, `viewer` sends the frame to the address, `none` does nothing.

**The conformance suite** gained options for what differs between viewers: `settle` (finish what
jsdom cannot, such as an image's `load` or a frame's `srcdoc`), `readyOnce` (the html viewer reports
every load of its frame), `hasTheme` and `themeClears` (the html and email viewers have no theme; the
code viewer has a theme of its own), `axeOptions` and `textOf`. Eight viewers run it on all three
entry points.

**Checked in a real browser** (`docs/design/spikes/phase2/verify.mjs`, now 30 checks): the eight
kinds of file each open through one `<fovea-viewer>` element, with the viewer's own CSS working
inside the shadow root (scrolling, sticky headers, monospace, flex layouts), plus everything from
Phase 2.

**What Phase 3 found**

1. **The React-free check caught a real leak.** The markdown package's `locate.js` imported the
   React `core` barrel for three pure functions, so `/vanilla` reached React. It now imports
   `core/vanilla`. The same pattern is in the Excel, PDF and PowerPoint packages' pure modules
   (`parseWorkbook`, `parsePresentation`, `pageTexts`) and will be moved in Phase 4.
2. **StrictMode and a parent that edits the DOM.** Described above (`useController`).
3. **Console CSP reports are not errors.** The html viewer blocks pictures on the web, and the
   browser reports that to the console. The browser check ignores those reports.
4. **Size.** `core` (the React entry) grew from 14.3 to 15.7 kB because it now carries the vanilla
   grid and frame behind `Grid` and `HtmlFrame`; its limit is 16.5 kB. The vanilla entries are 0.7 kB
   (html) to 50 kB (markdown, which is markdown-it), about the same as their React entries.

**Not done, by design**

- `<fovea-viewer>` cannot open PDF, Excel, Word or PowerPoint files yet (Phase 4).
- The element's `fovea-navigate` always holds a click back so the event can be cancelled; the
  viewer's own default is then done in the fallback. For the html viewer with `links="viewer"` that
  is `location.assign` on the frame, which differs from a native navigation only in that the click's
  default was already prevented.

## Phase 4: the heavy viewers

**What was built**

| In                 | What                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `fovea-word`       | `createWordViewer`, `<fovea-word>`: the page in a `createHtmlFrame`, like email                                     |
| `fovea-excel`      | `createExcelViewer`, `<fovea-excel>`: tabs and a `createGrid` for the sheet                                         |
| `fovea-powerpoint` | `createPowerpointViewer`, `<fovea-powerpoint>`, and a vanilla `slideView` (the shapes of a slide)                   |
| `fovea-pdf`        | `createPdfViewer` (document, password), `createPages` (toolbar, outline, the pages near the view), `createPageView` |
| `fovea-viewers`    | the vanilla registry has all twelve viewers; `createViewer` and `<fovea-viewer>` open any of them                   |

The React components, and `Pages`, `PageView`, `Outline`, `usePdfDocument` and `SlideView`, are gone
or are wrappers: the 21 PDF, 11 Excel, 11 PowerPoint and 7 Word tests written against the old React
components pass against the wrappers as written (the PDF and PowerPoint ones only take their fixtures from
`test-support` now).

**PDF.** The risk was the pdf.js worker. It is loaded by `pdfjs.js` with
`new URL('./pdf.worker.min.mjs', import.meta.url)`, and the controllers import that same module, so
`/vanilla`, `/element` and the React entry share one loader and one emitted worker (the Phase 0 spike
showed the layout). It is now checked end to end: `<fovea-viewer src="sample.pdf">` in a Vite app with
no React loads pdf.js and its worker as a chunk, draws a page on a canvas inside the shadow root, and
the canvas has painted pixels. A server has to send `.mjs` as JavaScript, as every real one does.

The controller is in three parts, so each can be reasoned about alone: `createPdfViewer` opens the
file and the document (cancelling a half-opened one, asking for a password, opening again when
`password` or `workerSrc` change without reading the file again), `createPages` owns the scroll
view (layout, zoom that keeps your place, the outline, the page box, finding the target) and
`createPageView` draws one page and its text layer and marks words in it.

**Excel.** The `document.getElementById(...).focus()` that Phase 0 flagged is gone: the tab bar keeps
its buttons (and so their focus) between renders and focuses the one it moved to. Each viewer has
its own ids, from a counter. The grid is re-used from Phase 3; the words are marked after the grid
has drawn the page that holds them, and again only when what they depend on changes.

**Word and PowerPoint.** Word is email's pattern. PowerPoint draws a slide with `slideView`, a
function that builds the slide from the parsed shapes with the safe element builder; the thumbnails
use it too. The stage and the toolbar stay in the page while slides change, so the stage keeps the
keyboard focus.

**Pure modules.** `parseWorkbook`, `parsePresentation` and `pageTexts` imported the React `core`
barrel for `squash` and `scoreMatch`. They now import `core/vanilla`. `check-vanilla-no-react` passes
for all 13 packages.

**The test harness** gained binary samples (the conformance `text` can be bytes), and uses a plain
response object for `fetcher` instead of a Node `Response`, because a Node `Blob` is not a `Blob` to
jsdom's `FileReader`, which the binary formats use. Shared fixtures moved to `test-support/pptx.js` and
`test-support/fake-pdfjs.js`.

**Checked in a real browser** (`verify.mjs`, 34 checks): all twelve kinds of file through
`<fovea-viewer>`, each styled inside its shadow root, with a PDF page painted by pdf.js's worker.

**Behaviour kept as it was**, including some that look odd: the PDF `fit` prop is only read when the
viewer starts; the PDF `target` is looked for in every page's text before it scrolls; `Excel`'s
`sheet` attribute is a name (the property also takes a place); a sheet change makes a new grid, so
it starts on its first page, unsorted.

**Not done**

- `<fovea-viewer>` passes `options` to the viewer but not attributes other than `src`, `type`,
  `theme` and `label`; use the viewer's own element for attributes.
- Phase 5: documentation pass, version and release workflow, a CI run on React 18, an accessibility
  review with a screen reader.

## Phase 5: release hardening

**Compatibility.** Every package's root exports were compared with `main`: nothing is missing
(`meta` is now re-exported from `meta.js`, and `@coldsofttech/fovea-viewers/core` gained
`useController`). The whole suite also passes against React 18.3.1, the oldest supported line, as
CI's React 18 job does.

**Accessibility.** The unit tests run axe in jsdom, which cannot check colour contrast or layout.
`verify.mjs` now runs axe-core in Chromium on all twelve viewers, inside their shadow roots, in the
default light colours and with the built-in dark theme (58 checks in all). It found real problems
that no unit test could:

1. **Default secondary text failed WCAG AA.** With no theme, line numbers, image alt text, feed
   metadata and similar text used `GrayText`: 3.9:1 on white. It is now
   `color-mix(in srgb, CanvasText 65%, Canvas)`, which is about 7:1 on a light page and stays
   readable on a dark one. Themes that set `--fovea-muted` are unchanged.
2. **A button's name did not contain its text** (WCAG 2.5.3): the image viewer's `100%` button was
   named `Actual size`. It is now `100% actual size`.
3. **Excel cells with a fill and no text colour** took the viewer's text colour, which in a dark theme
   is as light as a light fill. They now get black or white, whichever reads better.
4. **Email attachment buttons** used the browser's fixed `LinkText`; they follow `--fovea-link` now.

One exception is kept in view rather than fixed: a PowerPoint thumbnail is a picture of the slide
inside a button named by the slide's number and title. axe wants the whole text of the picture in the
name; a name with every word on a slide would be noise for a screen reader. The check filters that
one node and says why.

What this does not cover: screen reader testing (NVDA, JAWS, VoiceOver), which needs people and
machines this work did not have, and the keyboard paths in other browsers. The keyboard behaviour
is covered by the unit tests; a manual pass with a screen reader is the main thing still worth doing
before a 1.0.

**Release.**

- All 13 packages are at 0.2.0 and their peer ranges are `^0.2.0`; the changelog has a 0.2.0 entry.
  The release workflow is unchanged: a GitHub release tagged `<package>@0.2.0` publishes one
  package, so the shared package goes first, then the viewers (see `docs/development.md`).
- CI has a `browser` job that runs `verify:browser` and `verify:spikes` in Chromium. It is not in
  the required `ci` job yet, because it has not run on GitHub's runners; add it to `needs` once it
  has been stable.
- `npm run verify:browser` and `npm run verify:spikes` run the same checks locally.

**Housekeeping.** `sample.log`, which the demo and the smoke test refer to, was missing from
`examples/demo/public/samples`; it is added, so `npm run smoke` passes (48 of 48).

**What was left out on purpose**

- `Viewer` (React) and `createViewer` (vanilla) stay separate: the React one loads React
  components, the other loads controllers. They are the same file-type logic (`catalog.js`).
- No server-side rendering. The entries are safe to import on a server (nothing touches the DOM at
  import), but a viewer draws only in a browser.
- The email, html and Word viewers still have no `theme` prop; they draw a page on its own colours.

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

Next: release `0.2.0` (the shared package first), run `verify:browser` once on GitHub's runners, and
add the `browser` job to the required check when it is stable.
