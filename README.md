# react-public-repo-template

A ready-to-use starting point for public React component and hook libraries (React 18 and 19). It comes with community files, issue and pull request templates, automated dependency updates, security checks, testing, and publishing to npm already in place.

## What you get

- One or more npm packages in a single repository, each built and tested on its own
- An example React package (component, hook, styles, tests) and a small demo app to copy from
- Checks that React is never bundled, plus bundle-size limits
- Automatic checks on every pull request across Node 22, 24 and 26
- Publishing to npm when you create a GitHub release, with no stored tokens
- Contribution, conduct, support and security-reporting guidelines
- Issue forms and a pull request template
- Automated dependency updates, dependency review and weekly vulnerability checks
- Secret scanning before every commit

## Getting started

1. Click **Use this template** on GitHub and create your new repository.
2. Run the **Init** workflow from the Actions tab and merge the pull request it opens. This fills in your owner and repository name. Then delete `.github/workflows/init.yml`.
3. Rename `packages/example-react-package`, set your npm scope (replace `@scope`) and fill in the details in its `package.json`. Replace the example component, and update `.size-limit.json` and the demo imports.
4. Add your contact details in `CODE_OF_CONDUCT.md` and replace this description with your own.
5. Apply the repository protections and set up npm publishing by following the [setup guide](docs/repo-setup.md).
6. Install the checks that run on each commit: `npm ci && pip install pre-commit && pre-commit install --hook-type pre-commit --hook-type post-commit`.

## Using a package

```jsx
import { ExampleComponent } from '@scope/example-react-package';
import '@scope/example-react-package/style.css';

<ExampleComponent name="World" />;
```

React and `react-dom` 18 or 19 must be installed in your app.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
