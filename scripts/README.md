# Scripts

Helper scripts run by every package's `check:packages` command, and so by CI and the release workflow. They need Node 22 or newer and use no extra dependencies.

| Script              | What it checks                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `check-no-react.js` | The built package does not bundle React. React must stay a peer dependency.                            |
| `check-pack.js`     | The npm tarball contains only the built files and metadata, and no source, tests or other stray files. |

Run them for one package after building it, for example `npm run check:packages -w @coldsofttech/fovea-markdown`.
