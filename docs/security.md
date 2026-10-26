# Security

How Fovea Viewers handles untrusted files and catches security problems. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Handling untrusted files

Viewers open files chosen by someone other than the app's developer, so every file is treated as hostile.

- Email and Markdown content is sanitized before it is shown. The HTML viewer shows a page in a locked frame (below) and cleans its markup with DOMPurify.
- Viewers never run scripts from a file. Embedded scripts, event handlers and active content are removed or not rendered.
- A viewer makes network requests only for the `source` URL it is given, through the host's `fetcher` when one is provided. Remote resources inside a file (images, stylesheets, fonts) are not loaded unless the host allows it. The HTML viewer works the same way: pictures, styles and fonts need `allowImages` and `allowStyles`.
- An HTML page is cleaned, given a Content-Security-Policy that blocks everything it could load, and shown in a frame where forms and popups never work. Scripts, links, pictures and styles are each opt-in. With scripts on, the page runs in a frame of its own that cannot reach the host page, which also means the viewer cannot mark words in it.
- A feed's entries are shown as plain text. `richText` shows their HTML cleaned with DOMPurify, and pictures need `allowImages`. Feed text is read with the browser's XML parser, which does not load external files.
- Viewer styles are scoped, so a file cannot restyle the host page.
- Errors go to `onError`. A malformed file must not crash the host app.
- Prefer `textContent` or DOM APIs over `innerHTML`. If HTML is unavoidable, sanitize it first with DOMPurify and keep the `no-unsanitized` lint rule enabled.

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

CodeQL is required by the `main` ruleset. Semgrep is deliberately not part of the required `ci` check, so a newly published rule does not block unrelated pull requests. Its weekly run flags new findings after a merge. Results for pull requests from forks are not uploaded, because forks cannot write to the Security tab. The job still fails on findings.

## Handling findings

- A lint rule that is a false positive can be silenced on one line with a comment that says why. Do not disable a rule for the whole repository.
- A Semgrep finding can be suppressed with a `// nosemgrep: <rule-id>` comment and a reason.
- Dismiss a CodeQL alert in the Security tab with a recorded reason.
