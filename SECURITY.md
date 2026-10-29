# Security Policy

## Supported versions

Only the latest release of each `@coldsofttech/fovea-*` package receives security fixes.

## What counts as a vulnerability

Fovea Viewers opens files that may come from untrusted sources, so these are in scope:

- Script execution or HTML injection from a file (HTML, email, Markdown, SVG, feeds and similar)
- A file that makes a viewer load remote content, or make a network request, that the host did not allow
- A file that crashes, freezes or exhausts memory in a viewer
- A way for a file to affect the host page, such as styles or navigation
- Vulnerabilities in a dependency that a viewer exposes to users

## Reporting a vulnerability

Please do **not** report vulnerabilities in public issues.

Use GitHub's private reporting: go to the **Security** tab of this repository and choose **Report a vulnerability**.

Include the package and version, what you found, how to reproduce it (a small sample file helps), and the potential impact. You can expect an acknowledgement within a few days and updates as the fix progresses. Once a fix is released, we will credit you if you wish.
