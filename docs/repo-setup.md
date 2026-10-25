# Repository setup

Template repositories copy files only, not settings. After creating a repo from this template, apply the settings below.

## Automated

```bash
npm run repo:settings            # current repo
npm run repo:settings -- owner/repo # a specific repo
```

This configures squash-only merging, delete branch on merge, the `skip-changelog` label, secret scanning with push protection, Dependabot alerts and security updates, CodeQL default setup, and the `main` ruleset from `.github/rulesets/main.json`. Requires the `gh` CLI with admin rights.

## Protections

| Setting                         | Value                    | How                                           |
| ------------------------------- | ------------------------ | --------------------------------------------- |
| Dependency graph                | On                       | Default for public repos                      |
| Dependabot alerts               | On                       | Script                                        |
| Dependabot security updates     | On                       | Script                                        |
| Secret protection               | On, with push protection | Script                                        |
| CodeQL                          | Default setup            | Script                                        |
| Malware alerts                  | On                       | Manual: Settings > Advanced Security          |
| Copilot Autofix                 | Off                      | Manual: Settings > Advanced Security > CodeQL |
| Private vulnerability reporting | On                       | Manual: Settings > Advanced Security          |

## Ruleset `main` (default branch)

- Restrict deletions and block force pushes
- Require a pull request: dismiss stale approvals, require code owner review, require conversation resolution, squash merge only
- Require status checks to pass (`ci` and `dependency-review`), with branches up to date
- Require code scanning results (CodeQL)
- Require deployments to succeed: included with no environments, so it does nothing until you list one
- Require code quality results: enable manually in the ruleset UI, as it is not included in the JSON

Repository admins can bypass the ruleset through a pull request. This lets a solo maintainer merge despite the code owner requirement, since authors cannot approve their own PRs. Remove the bypass actor in `main.json` if you have more maintainers.

## Manual steps

- Tick **Template repository** on this repo (Settings > General).
- Run the **Init** workflow (Actions tab) to replace the template owner and repository name, merge its pull request, then delete `.github/workflows/init.yml`. It requires "Allow GitHub Actions to create and approve pull requests", which the settings script turns on. If the owner is an organization, change `.github/CODEOWNERS` to a team.
- Fill in the contact method in `CODE_OF_CONDUCT.md`.
- Run `pre-commit install --hook-type pre-commit --hook-type post-commit` locally (the post-commit type is needed for Sweepito cleanup).
- Publish to npm with trusted publishing (no token): create a GitHub environment named `npm` (Settings > Environments), then on npmjs.com open each package's Settings > Trusted publisher and register this repository, the workflow `release.yml` and the `npm` environment. A package must exist on npm before it can be configured, so publish the first version manually with `npm publish --access public`, then register the trusted publisher.
- CodeQL default setup only works once the repo contains a supported language, so run the script after adding code.
