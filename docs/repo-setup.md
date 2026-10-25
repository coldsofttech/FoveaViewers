# Repository setup

GitHub settings and npm publishing for this repository. Settings are not stored in the code, so a fork or a new copy of the repository needs them applied again.

## Settings

| Setting                         | Value                    | Notes                                      |
| ------------------------------- | ------------------------ | ------------------------------------------ |
| Merging                         | Squash only              | Delete branch on merge is on               |
| Dependency graph                | On                       | Default for public repos                   |
| Dependabot alerts               | On                       |                                            |
| Dependabot security updates     | On                       |                                            |
| Secret protection               | On, with push protection |                                            |
| CodeQL                          | Default setup            | Needs JavaScript in the repository         |
| Malware alerts                  | On                       | Settings > Advanced Security               |
| Copilot Autofix                 | Off                      | Settings > Advanced Security > CodeQL      |
| Private vulnerability reporting | On                       | Settings > Advanced Security               |
| Label `skip-changelog`          | Exists                   | Excludes a pull request from release notes |

## Ruleset `main` (default branch)

The ruleset is stored in `.github/rulesets/main.json`. Import it under Settings > Rules > Rulesets. It sets:

- Restrict deletions and block force pushes
- Require a pull request: dismiss stale approvals, require code owner review, require conversation resolution, squash merge only
- Require status checks to pass (`ci` and `dependency-review`), with branches up to date
- Require code scanning results (CodeQL)
- Require code quality results: enable manually in the ruleset UI, as it is not included in the JSON

Repository admins can bypass the ruleset through a pull request. This lets a solo maintainer merge despite the code owner requirement, since authors cannot approve their own pull requests. Remove the bypass actor in `main.json` when there are more maintainers.

## Publishing to npm

Releases use npm trusted publishing, so no token is stored.

1. Create a GitHub environment named `npm` (Settings > Environments).
2. Publish the first version of each package manually, because a package must exist on npm before it can be configured: `npm publish --access public -w @coldsofttech/fovea-<name>`.
3. On npmjs.com, open each package's Settings > Trusted publisher and register this repository, the workflow `release.yml` and the `npm` environment.
4. Later versions are published by creating a GitHub release. See [development.md](development.md#release).

There are 13 packages: `fovea-viewers` and the viewers `code`, `email`, `excel`, `feed`, `html`, `image`, `markdown`, `pdf`, `powerpoint`, `table`, `text` and `word`.

## Local checks

Run `pre-commit install --hook-type pre-commit --hook-type post-commit` after cloning. The post-commit type is needed for Sweepito cleanup.
