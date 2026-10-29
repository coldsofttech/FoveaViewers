# @coldsofttech/fovea-email

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-email)](https://www.npmjs.com/package/@coldsofttech/fovea-email)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

An email viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

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

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { EmailViewer } from '@coldsofttech/fovea-email';
import '@coldsofttech/fovea-email/style.css';

<div style={{ height: 500 }}>
  <EmailViewer source={file} />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

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
