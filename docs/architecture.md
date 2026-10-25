# Architecture

How the pieces of this template fit together. For day-to-day commands, see [development](development.md). For one-time repository settings, see [repository setup](repo-setup.md).

## Overview

A change moves through three layers of checks before it reaches `main`, and a release moves through one more before it reaches npm.

```mermaid
flowchart LR
    A[Commit] -->|pre-commit hooks| B[Push branch]
    B --> C[Pull request]
    C --> D{CI and security checks}
    D -->|pass + review| E[Squash merge to main]
    E --> F[GitHub release]
    F --> G[Release workflow]
    G --> H[npm]
```

## Layers

| Layer        | What runs                                                                                                                                                                                       | Where            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Local        | gitleaks, file hygiene, actionlint, Prettier, ESLint, Vitest, Sweepito scan and cleanup                                                                                                         | pre-commit hooks |
| Pull request | `ci` (lint, tests with coverage on Node 22, 24 and 26 on Ubuntu plus Node 24 on Windows and macOS, build and package checks), dependency review, CodeQL, Semgrep (`security.yml`, not required) | GitHub Actions   |
| Repository   | Branch ruleset, secret scanning with push protection, Dependabot alerts and updates                                                                                                             | GitHub settings  |
| Release      | Tag and version check, build, trusted publish to npm with provenance                                                                                                                            | `release.yml`    |

## Source layout

```text
packages/<name>/       one publishable package: src/, tests next to source, own vite.config.js
examples/demo/         small Vite app that consumes the packages
scripts/               repository helper scripts (see scripts/README.md)
vitest.config.js       runs every package as a Vitest project, sets coverage thresholds
eslint.config.js       shared lint rules
jsconfig.json          JSDoc type checking (plain JavaScript, no TypeScript)
package-lock.json      locked dependency set, installed in CI with `npm ci`
```

Each package owns its version in its `package.json`, builds on its own with Vite library mode, and ships ES modules plus `.d.ts` files generated from JSDoc. Packages never import from an application. The release workflow compares the release tag with the package version.

## Workflows

| Workflow                | Trigger                                                           | Purpose                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | Pull request, push to `main`                                      | Runs `lint`, `test` and `build` in parallel. A final `ci` job gates on all three and is the only check the ruleset requires. |
| `dependency-review.yml` | Pull request                                                      | Blocks pull requests that add vulnerable dependencies.                                                                       |
| `audit.yml`             | Weekly, manual, and pull requests that change `package-lock.json` | Runs `npm audit` on production dependencies to catch newly published vulnerabilities.                                        |
| `security.yml`          | Pull request, push to `main`, weekly, manual                      | Runs Semgrep and uploads SARIF to the Security tab. Not part of the required `ci` check.                                     |
| `release.yml`           | GitHub release published                                          | Checks the tag matches the package version, builds, then publishes that package to npm.                                      |

CodeQL runs through GitHub's default setup rather than a workflow file.

## Branch governance

The `main` ruleset in `.github/rulesets/main.json` is applied by `scripts/apply-repo-settings.js`. It requires:

- a pull request with a code owner review and resolved conversations, squash merge only
- the `ci` and `dependency-review` checks, with the branch up to date
- CodeQL results
- no deletion and no force push

Repository admins can bypass through a pull request so a solo maintainer is not locked out.

## Release flow

1. Bump `version` in the package's `package.json` in a pull request.
2. After merge, publish a GitHub release tagged `<package name>@<version>`, for example `@coldsofttech/fovea-viewers@1.0.0`.
3. `release.yml` builds and packs that package in one job, then a second job in the `npm` environment publishes it using OpenID Connect. No token is stored, and only the publish job gets the `id-token` permission.

## Template lifecycle

GitHub copies files, not settings. A new repo therefore needs three steps: run **Init** to replace the template owner and name, rename the example package and set your npm scope, and run `npm run repo:settings` to apply protections and the ruleset.
