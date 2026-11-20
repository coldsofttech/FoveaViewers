# @coldsofttech/fovea-powerpoint

[![npm](https://img.shields.io/npm/v/@coldsofttech/fovea-powerpoint)](https://www.npmjs.com/package/@coldsofttech/fovea-powerpoint)
[![CI](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml/badge.svg)](https://github.com/coldsofttech/FoveaViewers/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/coldsofttech/FoveaViewers/blob/main/LICENSE)

A PowerPoint viewer for React, plain JavaScript and as a Web Component. It is part of [Fovea Viewers](https://github.com/coldsofttech/FoveaViewers), a set of file viewers you can install one at a time.

## Features

- Opens `.pptx` and `.pptm` files from a URL, a `File` or `Blob`, or raw bytes. Macros are never run.
- Shows each slide with its text, lists, tables and pictures where they are in the file, scaled to fit.
- Moves between slides with buttons, the arrow keys, Home and End, or a strip of small slides.
- Shows the speaker notes under the slide.
- Finds words anywhere in the presentation, shows their slide and marks them, for example to show a search result.
- Safe: it reads the file and draws plain text and pictures. Nothing is loaded from the web and nothing runs.
- Works with the keyboard and screen readers.

## Install

```bash
npm install @coldsofttech/fovea-powerpoint @coldsofttech/fovea-viewers
```

React and `react-dom` 18 or 19 must be installed in your app if you use the React component. The plain JavaScript and Web Component entry points (below) need no React.

## Use

```jsx
import { PowerpointViewer } from '@coldsofttech/fovea-powerpoint';
import '@coldsofttech/fovea-powerpoint/style.css';

<div style={{ height: 500 }}>
  <PowerpointViewer source={file} />
</div>;
```

The viewer fills the height of its parent, so give the parent a height. The reading code is loaded the first time a presentation is opened, so a page that never shows one never pays for it.

## Without React

The same viewer is available from plain JavaScript and as a Web Component. Neither needs React.

```js
import { createPowerpointViewer } from '@coldsofttech/fovea-powerpoint/vanilla';
import '@coldsofttech/fovea-powerpoint/style.css';

const viewer = createPowerpointViewer(document.getElementById('host'), {
  source: file, // a URL, File, Blob or ArrayBuffer
  slide: 2,
  thumbnails: false,
  onError: (error) => console.error(error),
});

viewer.update({ theme: 'dark' }); // change props later
viewer.destroy(); // remove the viewer and stop loading
```

`createPowerpointViewer(container, props)` takes the props in the table below and returns `{ element, update, destroy }`. The container needs a height.

```html
<script type="module">
  import '@coldsofttech/fovea-powerpoint/element'; // registers <fovea-powerpoint>
</script>

<fovea-powerpoint src="/files/launch.pptx" style="height: 500px"></fovea-powerpoint>
```

The element draws into a shadow root, so no stylesheet has to be imported and the page's styles do not leak in. It fills the height of its parent, or the height you give it.

| Attribute or property      | Notes                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `src` / `source`           | A URL as an attribute. A `File`, `Blob` or `ArrayBuffer` goes in the `source` property. |
| `theme`                    | `light` or `dark`. The property also takes an object of colours.                        |
| `label`, `slide`           | As the props of the same name (`slide` counts from 0).                                  |
| `show-notes`, `thumbnails` | On by default: `show-notes="false"` and `thumbnails="false"` turn them off.             |
| `fetcher`, `target`        | Properties only.                                                                        |

Events: `fovea-ready` (`event.detail.slideCount`), `fovea-slide-change` (`event.detail` is the slide's place, from 0), `fovea-marked` (`event.detail` is whether the target's words were marked, or `null`) and `fovea-error` (`event.detail` is the `Error`). Colours also come from `--fovea-*` custom properties set on the element or on any ancestor.

## Props

| Prop            | Description                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `source`        | The presentation: a URL string, a `File` or `Blob`, or an `ArrayBuffer`.                                                     |
| `fetcher`       | Optional `(url) => Promise<Response>` used for URL sources, so you control sign-in and requests.                             |
| `theme`         | `'light'`, `'dark'`, or an object of colours around the slides. Leave it out to use the page's colours.                      |
| `label`         | The accessible name. Defaults to `Presentation`.                                                                             |
| `slide`         | The slide to show, from 0. When given, you decide the slide.                                                                 |
| `onSlideChange` | Called with the slide's place (from 0) when another slide is chosen.                                                         |
| `showNotes`     | Show the speaker notes under the slide. Defaults to `true`.                                                                  |
| `thumbnails`    | Show the strip of small slides. Defaults to `true`.                                                                          |
| `target`        | `{ matched, before?, after? }`: words to find in the presentation. Their slide is shown and the words marked.                |
| `onMarked`      | Called with `true` when the target's words were marked, `false` when they are not in the presentation, `null` for no target. |
| `onReady`       | Called with `{ slideCount }` once the presentation is shown.                                                                 |
| `onError`       | Called with an `Error` when the file cannot be loaded or read. The viewer also shows the message.                            |

## Examples

### Choose the slide yourself

```jsx
const [slide, setSlide] = useState(0);

<PowerpointViewer source={file} slide={slide} onSlideChange={setSlide} />;
```

### A compact view without the strip or notes

```jsx
<PowerpointViewer source={file} thumbnails={false} showNotes={false} />
```

### Show a search result

```jsx
<PowerpointViewer
  source={file}
  target={{ matched: 'Launch plan' }}
  onMarked={(found) => console.log(found)}
/>
```

### Open any file with `Viewer`

```jsx
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} />;
```

## Good to know

- This is a reading view, not a copy of PowerPoint. Text, lists, tables and pictures are shown; shapes, lines, charts, SmartArt, video, animations and transitions are not.
- Text sizes, fonts and colours that come from the presentation's theme are not read, so text without its own size or a fixed colour is shown in a plain default.
- A numbered list is shown with bullets.
- Text that sits in a shape the file positions through its layout is placed where the layout puts it; slides that rely on the theme's other settings may look plainer than in PowerPoint.
- Only `.pptx` and `.pptm` are supported, not the older `.ppt`.

## Accessibility

Each slide is a labelled group ("Slide 2 of 5: Results") that can be focused and moved with the arrow keys. A slide's title is a heading, lists are lists and tables are tables, so screen readers can move through them. The small slides are buttons with their number and title.

## License

MIT
