# @coldsofttech/fovea-email

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-email)](https://www.npmjs.com/package/@coldsofttech/fovea-email)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

An email viewer for React, plain JavaScript and as a Web Component. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens an `.eml` message from a URL, a `File` or `Blob`, or raw bytes.
- Shows the subject, sender, recipients and date.
- Switches between the formatted message and its plain text.
- Lists attachments, which can be downloaded or handed to your app.
- Shows pictures embedded in the message.
- Shows every raw header on request.
- Safe by default: nothing is loaded from the web, no script runs, and links do nothing.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-email @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app if you use the React component. The plain JavaScript and Web Component entry points (below) need no React.

## Use

```jsx
import { EmailViewer } from '@coldsofttech/fovea-email';
import '@coldsofttech/fovea-email/style.css';

<div style={{ height: 500 }}>
  <EmailViewer source={file} />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Without React

The same viewer is available from plain JavaScript and as a Web Component. Neither needs React.

```js
import { createEmailViewer } from '@coldsofttech/fovea-email/vanilla';
import '@coldsofttech/fovea-email/style.css';

const viewer = createEmailViewer(document.getElementById('host'), {
  source: file, // a URL, File, Blob or ArrayBuffer
  view: 'text',
  links: 'window',
  onError: (error) => console.error(error),
});

viewer.update({ theme: 'dark' }); // change props later
viewer.destroy(); // remove the viewer and stop loading
```

`createEmailViewer(container, props)` takes the props in the table below and returns `{ element, update, destroy }`. The container needs a height.

```html
<script type="module">
  import '@coldsofttech/fovea-email/element'; // registers <fovea-email>
</script>

<fovea-email src="/mail/welcome.eml" style="height: 500px"></fovea-email>
```

The element draws into a shadow root, so no stylesheet has to be imported and the page's styles do not leak in. It fills the height of its parent, or the height you give it.

| Attribute or property          | Notes                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `src` / `source`               | A URL as an attribute. A `File`, `Blob` or `ArrayBuffer` goes in the `source` property. |
| `label`, `links`, `view`       | As the props of the same name.                                                          |
| `allow-images`, `allow-styles` | As the props of the same name. Both are off unless the attribute is there.              |
| `fetcher`                      | Property only.                                                                          |

Events: `fovea-ready` (`event.detail` is the parsed message), `fovea-navigate` and `fovea-attachment` (see below) and `fovea-error` (`event.detail` is the `Error`). A click on a link fires `fovea-navigate` (`event.detail` has `href` and the click `event`), and a click on an attachment fires `fovea-attachment` (`event.detail` is the attachment). Call `preventDefault()` on either to handle it yourself; otherwise `links` decides for a link and the attachment is downloaded. Colours also come from `--fovea-*` custom properties set on the element or on any ancestor.

## Props

| Prop           | Description                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `source`       | The message: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                          |
| `fetcher`      | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.             |
| `allowImages`  | Let `http` and `https` pictures in the message load. Off by default.                                         |
| `allowStyles`  | Let `http` and `https` stylesheets and fonts load. Off by default.                                           |
| `links`        | What a click on a link does: `'none'` (the default) or `'window'`.                                           |
| `onNavigate`   | Optional `(href, event) => void`. When given, a click on a link calls it instead of doing what `links` says. |
| `view`         | Which version to show first: `'html'` (the default, when the message has one) or `'text'`.                   |
| `onAttachment` | Optional `(attachment) => void`. When given, a click on an attachment calls it instead of downloading.       |
| `label`        | The accessible name of the message. Defaults to `Email message`.                                             |
| `onReady`      | Called with the message once it has loaded.                                                                  |
| `onError`      | Called with an `Error` when the file cannot be loaded. The viewer also shows the message.                    |

## What is on by default

Nothing that reaches out. The message is cleaned and shown in a locked frame, so it cannot load pictures, styles or fonts from the web, run scripts or tell the sender it was opened. This is how tracking pixels are stopped. Pictures that are part of the message itself still show.

## Good to know

- Only `.eml` files are supported, not Outlook `.msg` files.
- Attachments are listed and saved as they are. Pictures embedded in the message are shown in the message and are not listed.
- Remote pictures, styles and fonts stay blocked unless you set `allowImages` or `allowStyles`.

## License

MIT
