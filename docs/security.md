# Security

How this template catches security problems, from the editor to a published package. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Layers

| Layer        | Tool                                                            | Catches                                                                               | Where                     |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------- |
| Local        | gitleaks                                                        | Secrets in commits                                                                    | pre-commit                |
| Local and CI | ESLint with `no-unsanitized` and `security` plugins             | DOM XSS sinks (`innerHTML`, `insertAdjacentHTML`), unsafe regex, `eval`-like patterns | pre-commit, `ci` lint job |
| Pull request | Dependency review                                               | Vulnerable dependencies added by a change                                             | `dependency-review.yml`   |
| Scheduled    | `npm audit`                                                     | Advisories published against dependencies already in use                              | `audit.yml`               |
| Static scan  | CodeQL                                                          | Data-flow vulnerabilities in JavaScript                                               | GitHub default setup      |
| Static scan  | Semgrep (`p/javascript`, `p/owasp-top-ten`, `p/github-actions`) | Browser and WebView patterns, unsafe workflow settings                                | `security.yml`            |
| Repository   | Secret scanning with push protection, Dependabot alerts         | Leaked tokens, vulnerable dependencies                                                | GitHub settings           |
| Release      | npm trusted publishing with provenance                          | Stolen publish tokens, unverifiable builds                                            | `release.yml`             |

## Semgrep and CodeQL

Both upload SARIF results to the Security tab. CodeQL is required by the `main` ruleset. Semgrep is deliberately **not** part of the required `ci` check, so a newly published rule does not block unrelated pull requests. Its weekly run flags new findings after a merge.

Semgrep runs from its official container image, so the repository needs no Python. Test files are excluded, and the rule that asks for pinning actions to commit SHAs is skipped because actions are pinned to version tags and kept current by Dependabot.

Results for pull requests from forks are not uploaded, because forks cannot write to the Security tab. The job still fails on findings.

## Writing safe browser code

- Prefer `textContent` or DOM APIs over `innerHTML`. If HTML is unavoidable, sanitize it first (for example with DOMPurify) and keep the lint rule enabled.
- Treat `location`, `postMessage` data and storage values as untrusted input.
- Validate `event.origin` in `message` handlers and never post to `"*"` with sensitive data.
- Keep tokens out of `localStorage` where a cookie with `HttpOnly` is possible.
- Packages receive host data through options and never reach into the application.

## Handling findings

- A lint rule that is a false positive can be silenced on one line with a comment that says why. Do not disable a rule for the whole repository.
- A Semgrep finding can be suppressed with a `// nosemgrep: <rule-id>` comment and a reason.
- Dismiss a CodeQL alert in the Security tab with a recorded reason.
