# Contributing

Thanks for taking the time to contribute! By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and requesting features

Open an issue using one of the provided forms. Search existing issues first. For security problems, do **not** open an issue; follow [SECURITY.md](SECURITY.md).

## How the repository is organized

Each viewer is its own npm package under `packages/`, named `@coldsofttech/fovea-<type>`. `packages/fovea-viewers` holds the code shared by all viewers and picks the right viewer for a file. `examples/demo` is a small app for trying the packages. See [docs/development.md](docs/development.md) for the details.

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Make your change, keeping it focused on one thing, ideally one package.
3. Install dependencies and the commit checks: `npm ci && pip install pre-commit && pre-commit install --hook-type pre-commit --hook-type post-commit`. Node 22 or newer is required (see `.nvmrc`).
4. Add or update tests for the package you changed. Components need an `axe` accessibility check. You can run one package with `npx vitest run packages/fovea-markdown`.
5. Add an entry under `[Unreleased]` in `CHANGELOG.md` (one or two lines, written from a reader's point of view). If you add or remove an export or prop, update that package's README too.
6. Open a pull request and fill in the template.

## Code guidelines

- Plain JavaScript with JSDoc types, `.jsx` for components, named exports only.
- React and `react-dom` stay peer dependencies and are never bundled.
- Content from files is untrusted. Sanitize HTML, email and Markdown by default, and make network requests only through the `fetcher` option. See [docs/security.md](docs/security.md).
- Components must work with the keyboard and screen readers.

## Pull request rules

- `main` is protected: changes land through pull requests that are squash-merged.
- Required checks must pass and the branch must be up to date.
- A code owner must review, and all conversations must be resolved.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), for example `fix: handle empty input`.
