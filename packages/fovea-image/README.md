# @coldsofttech/fovea-image

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-image)](https://www.npmjs.com/package/@coldsofttech/fovea-image)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

An image viewer for React. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens an image from a URL, a `File` or `Blob`, or raw bytes.
- Shows what your browser can show: PNG, JPEG, GIF, WebP, AVIF, BMP and SVG.
- Fits the image to the view, to its width, or shows it at its own size.
- Zooms with buttons, the keyboard and the mouse wheel.
- Moves around a zoomed image by dragging or with the arrow keys.
- Turns the image in quarter turns.
- Shows the image's size and type under it.
- Light and dark themes, your own colours, or the colours of the page it sits in.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-image @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app.

## Use

```jsx
import { ImageViewer } from '@coldsofttech/fovea-image';
import '@coldsofttech/fovea-image/style.css';

<div style={{ height: 500 }}>
  <ImageViewer source="https://example.com/photo.jpg" alt="A mountain lake" theme="dark" />
</div>;
```

The viewer fills the height of its parent, so give the parent a height.

## Props

| Prop       | Description                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `source`   | The image: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                 |
| `fetcher`  | Optional `(url) => Promise<Response>`. When given, URL sources are loaded with it.                |
| `theme`    | `'light'`, `'dark'`, or an object of colours. Leave it out to use the page's colours.             |
| `label`    | The accessible name of the viewer. Defaults to `Image`.                                           |
| `alt`      | What the image shows, for screen readers. Defaults to `label`.                                    |
| `fit`      | How the image is first sized: `'contain'` (the default), `'width'` or `'actual'`.                 |
| `showInfo` | Show the image's size and type under it. Defaults to `true`.                                      |
| `onReady`  | Called with `{ width, height, size, type }` once the image is shown.                              |
| `onError`  | Called with an `Error` when the image cannot be loaded or shown. The viewer also shows a message. |

## Key props

### `source` and `fetcher`

A URL on its own is handed straight to the browser, so the image loads the way it does in any page: no extra request, and nothing needed from the server beyond serving the image. Give a `fetcher` and the viewer loads the image itself, so you control sign-in and transport:

```jsx
const fetcher = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

<ImageViewer source="https://example.com/private.png" fetcher={fetcher} />;
```

A `File`, `Blob` or `ArrayBuffer` is always loaded by the viewer. It is shown from a temporary address that is released when the image changes or the viewer goes away.

### `fit`

| `fit`       | The image is first shown…                                       |
| ----------- | --------------------------------------------------------------- |
| `'contain'` | …shrunk to fit the view, never enlarged. This is the default.   |
| `'width'`   | …as wide as the view, so a tall image can be moved up and down. |
| `'actual'`  | …at its own size, one image pixel to one screen pixel.          |

The reader can change this at any time with the **Fit**, **Width** and **100%** buttons.

### `alt`

Describe what the image shows. Without it the `label` is used, which names the viewer rather than the picture.

## Controls

| To…                  | Mouse                           | Keyboard (focus the image first) |
| -------------------- | ------------------------------- | -------------------------------- |
| Zoom in or out       | Wheel, or the `+` / `−` buttons | `+` and `-`                      |
| Fit to the view      | **Fit** button                  | `0`                              |
| Show at its own size | **100%** button                 | `1`                              |
| Move the image       | Drag                            | Arrow keys                       |
| Turn left or right   | ↺ and ↻ buttons                 | `[` and `]`                      |

Zoom runs from 5% to 1600%. An image smaller than the view stays centred.

## Examples

### Know the image's size

```jsx
<ImageViewer
  source={file}
  onReady={({ width, height, size }) => console.log(`${width} × ${height}`, size)}
/>
```

`size` and `type` are known only for an image the viewer loaded itself (a file, or a URL with a `fetcher`). For a URL given to the browser they are `null`.

### Open any file with `Viewer`

`Viewer` from `@coldsofttech/fovea-viewers` picks the viewer from the file's name, URL or type, so image files open here automatically. Props such as `fit` are passed on.

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} fit="width" />;
```

## Good to know

- **SVG is a picture:** it is shown like any other image, so scripts inside it never run and it cannot reach your page. Links and animations in it do not work either.
- **Formats:** the viewer shows whatever your browser can draw. Formats the browser cannot (for example TIFF or HEIC) are reported through `onError`.
- **Animated images:** GIFs and WebP animations play as normal.
- **Colours:** the area around the image follows `theme`; the image itself is never recoloured.

## Accessibility

- The image area is a region named by `label`, which can be reached with the keyboard, and the image carries `alt`.
- Every control is a labelled button, and the keyboard shortcuts above work without a mouse.
- A loading message and any error are announced.

## License

MIT
