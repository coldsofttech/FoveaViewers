# Development

## Setup

- Node 22 or newer. `.nvmrc` pins 24, the version used for linting, building and releasing.
- `npm ci` installs every workspace (`packages/*`, `examples/*`).
- `pip install pre-commit && pre-commit install --hook-type pre-commit --hook-type post-commit`.

## Scripts

All scripts run from the repository root.

| Script                            | Purpose                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Start the demo app (build packages first with `npm run build`)   |
| `npm run build`                   | Build every package (Vite library mode, then `.d.ts` from JSDoc) |
| `npm run lint`                    | ESLint across the repository                                     |
| `npm run format` / `format:check` | Prettier write / check, including Markdown                       |
| `npm test` / `test:coverage`      | Vitest; coverage thresholds live in `vitest.config.js`           |
| `npm run check:packages`          | `publint` and `@arethetypeswrong/cli` on each built package      |

## Conventions

- Plain JavaScript (`.jsx` for components) with ES modules. Types are written as JSDoc and checked through `jsconfig.json`.
- Each package declares `exports`, `types`, `files` and `sideEffects: false`, and builds and tests on its own. Its test environment is set in its `vite.config.js`.
- React and `react-dom` are `peerDependencies` (`^18 || ^19`), never bundled. `npm run check:packages` fails if a build contains React.
- Components and hooks are named exports and document props with JSDoc typedefs. Styles are CSS modules, shipped as one `style.css` that consumers import (`@scope/pkg/style.css`).
- Packages are client-only unless stated otherwise. If an entry needs `"use client"`, make sure the build keeps the directive.
- Tests use Vitest, jsdom, Testing Library and `vitest-axe`; `vitest.setup.js` renders everything in StrictMode. Query by role and label.
- Packages never import from an application.
- Prettier owns formatting for all files. markdownlint is not used.

## Keeping up with the JS template

This repo is created from `js-FoveaViewers` and receives no automatic updates. When a fix lands there:

1. Compare the changed files with this repo and apply the fix by hand.
2. Re-check the files this template extends: `eslint.config.js`, `vitest.config.js`, `jsconfig.json`, `.github/workflows/ci.yml`, the example package and `examples/demo`.
3. Note the change in `CHANGELOG.md`.

## CI

`ci.yml` runs `lint`, `test` (Node 22, 24, 26 on Ubuntu; Node 24 on Windows and macOS, all with React 19; plus Node 24 with React 18) and `build`. `build` also builds the demo, checks tarball contents and reports gzipped bundle size against `.size-limit.json`. The final `ci` job is the single required check for the `main` ruleset. `audit.yml` runs `npm audit` weekly and when `package-lock.json` changes.

## Release

1. Set the new `version` in the package's `package.json` and merge it.
2. Publish a GitHub release tagged `<package name>@<version>`, for example `@scope/example-react-package@1.0.0`.
3. `release.yml` checks the tag against the package version, builds, and publishes to npm with provenance through the `npm` environment. See [repo-setup.md](repo-setup.md) for the one-time npm setup.

## Cleanup

`sweepito.toml` uses the `node` profile at `safe` risk. `dist/` and `coverage/` are `configurable` in Sweepito, so they are kept unless enabled explicitly.
