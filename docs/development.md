# Development

## Setup

- Node 22 or newer. `.nvmrc` pins 24, the version used for linting, building and releasing.
- `npm ci` installs every workspace (`packages/*`, `examples/*`).
- `pip install pre-commit && pre-commit install --hook-type pre-commit --hook-type post-commit`.

## Layout

```text
packages/fovea-viewers/   shared package: /core helpers, viewer registry, file-type detection
packages/fovea-<type>/    one viewer per file type (code, email, excel, feed, html, image,
                          markdown, pdf, powerpoint, table, text, word)
examples/demo/            Vite app that consumes the built packages
scripts/                  package checks run by `check:packages`
```

Each package owns its version, builds on its own with Vite library mode, and ships ES modules plus `.d.ts` files generated from JSDoc.

`@coldsofttech/fovea-viewers` has two entry points. `/core` holds code shared by the viewers (reading a URL, Blob, File or ArrayBuffer, loading state) and imports no viewer. The main entry holds the registry, which loads viewers on demand. Viewers import only `/core` and list `fovea-viewers` as a peer dependency, and `fovea-viewers` lists every viewer as an optional peer dependency, so the two never depend on each other at runtime.

The registry keeps its own copy of each viewer's MIME types and extensions so it can pick a viewer without loading it. When a viewer's `meta` changes, update `packages/fovea-viewers/src/registry.js` to match.

## Scripts

All scripts run from the repository root.

| Script                            | Purpose                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Start the demo app (build packages first with `npm run build`)   |
| `npm run build`                   | Build every package (Vite library mode, then `.d.ts` from JSDoc) |
| `npm run lint`                    | ESLint across the repository                                     |
| `npm run format` / `format:check` | Prettier write / check, including Markdown                       |
| `npm test` / `test:coverage`      | Vitest; coverage thresholds live in `vitest.config.js`           |
| `npm run check:packages`          | `publint`, `@arethetypeswrong/cli` and the checks in `scripts/`  |
| `npm run size`                    | Gzipped size of each package against `.size-limit.json`          |

To work on one package, scope the command, for example `npx vitest run packages/fovea-markdown` or `npm run build -w @coldsofttech/fovea-markdown`.

## Conventions

- Plain JavaScript (`.jsx` for components) with ES modules. Types are written as JSDoc and checked through `jsconfig.json`.
- Each package declares `exports`, `types`, `files` and `sideEffects`, and builds and tests on its own. Its test environment is set in its `vite.config.js`.
- React and `react-dom` are `peerDependencies` (`^18 || ^19`), never bundled. `npm run check:packages` fails if a build contains React.
- Components and hooks are named exports and document props with JSDoc typedefs. Styles are CSS modules, shipped as one `style.css` that consumers import.
- Viewers are client-only. If an entry needs `"use client"`, make sure the build keeps the directive.
- Tests use Vitest, jsdom, Testing Library and `vitest-axe`; `vitest.setup.js` renders everything in StrictMode. Query by role and label, and run an `axe` check for every component.
- Viewers never import from an application. Host data comes in through props and callbacks.
- Prettier owns formatting for all files. markdownlint is not used.

## CI

`ci.yml` runs `lint`, `test` (Node 22, 24, 26 on Ubuntu; Node 24 on Windows and macOS, all with React 19; plus Node 24 with React 18) and `build`. `build` also builds the demo, checks tarball contents and reports gzipped bundle size against `.size-limit.json`. The final `ci` job is the single required check for the `main` ruleset. `dependency-review.yml` blocks pull requests that add vulnerable dependencies. `audit.yml` runs `npm audit` weekly and when `package-lock.json` changes. `security.yml` runs Semgrep and is not required.

## Release

Each package is released on its own.

1. Set the new `version` in the package's `package.json` and merge it.
2. Publish a GitHub release tagged `<package name>@<version>`, for example `@coldsofttech/fovea-markdown@0.2.0`.
3. `release.yml` checks the tag against the package version, builds, and publishes that package to npm with provenance through the `npm` environment. See [repo-setup.md](repo-setup.md) for the one-time npm setup.

When a package's public API changes, add a short `[Unreleased]` entry to `CHANGELOG.md` and update that package's README.

## Cleanup

`sweepito.toml` uses the `node` profile at `safe` risk. `dist/` and `coverage/` are `configurable` in Sweepito, so they are kept unless enabled explicitly.
