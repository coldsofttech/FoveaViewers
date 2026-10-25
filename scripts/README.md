# Scripts

Helper scripts for maintaining the repository. They need Node 22 or newer and use no extra dependencies.

## apply-repo-settings.js

Applies the standard repository settings in one go: squash-only merging, delete branch on merge, secret scanning with push protection, Dependabot alerts and security updates, CodeQL default setup, the `skip-changelog` label and the `main` ruleset from `.github/rulesets/main.json`.

### Before you run it

- Install the [GitHub CLI](https://cli.github.com/) and sign in with `gh auth login`.
- Use an account with admin rights on the repository.
- CodeQL setup only works once the repository contains JavaScript, so run the script after adding code.

### Run it

From the repository root:

```bash
npm run repo:settings                # the current repository
npm run repo:settings -- owner/repo  # a specific repository
```

Or call it directly: `node scripts/apply-repo-settings.js [owner/repo]`.

It is safe to run again. If a ruleset named `main` already exists, it is left untouched. When it finishes, complete the manual steps in [docs/repo-setup.md](../docs/repo-setup.md).
