# Scripts

Helper scripts run by every package's `check:packages` command, and so by CI and the release workflow. They need Node 22 or newer and use no extra dependencies.

| Script                      | What it checks                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-no-react.js`         | The built package does not bundle React. React must stay a peer dependency.                                                                                                                             |
| `check-vanilla-no-react.js` | The React-free entry points (`./vanilla`, `./element`, `./core/vanilla`, `./core/element`) cannot reach React through any import, direct or through a shared chunk. A package with none of them passes. |
| `check-pack.js`             | The npm tarball contains only the built files and metadata, and no source, tests or other stray files.                                                                                                  |

| `smoke-test.js` | Not part of `check:packages`. Packs every package, installs the tarballs in a fresh app in `.temp/smoke`, builds it with Vite and opens every demo sample in it. See below. |

`vite-plugin-css-module.js` is a Vite plugin, not a check: a package's library build uses it to emit `style.css.js`, the CSS as a module, for its Web Component. The scripts have their own tests (`npm test`, the `scripts` project).

Run them for one package after building it, for example `npm run check:packages -w @coldsofttech/fovea-markdown`.

## Smoke test

`npm run build` and then `npm run smoke` installs the packed packages, as a user would, in a new app (`scripts/smoke/` is its template, and the demo's sample files are copied in). It then runs `vite build` on the app and a Vitest run that checks that every viewer loads and exports the component `Viewer` looks for, and that every sample opens without an error. Use `npm run smoke -- --react 18` to try React 18. It takes about a minute, so it is not part of CI. Run it before a release.
