import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createPowerpointViewer } from './vanilla/createPowerpointViewer.js';

/**
 * Registers `<fovea-powerpoint>`, the PowerPoint viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `slide` (from 0), `show-notes` and
 * `thumbnails` (both on by default: `show-notes="false"` and `thumbnails="false"` turn them off).
 * Properties: those, plus `source` (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher`, `target` and
 * `theme` (also an object of colours). Events: `fovea-ready` (`detail.slideCount`),
 * `fovea-slide-change` (`detail` is the slide's place, from 0), `fovea-marked` (`detail` is whether
 * the target's words were marked, or `null`) and `fovea-error` (`detail` is the `Error`).
 */
export const definePowerpointElement = defineViewerElement({
  tag: 'fovea-powerpoint',
  create: createPowerpointViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    slide: ['slide', 'number'],
    'show-notes': ['showNotes', 'boolean'],
    thumbnails: ['thumbnails', 'boolean'],
  },
  properties: ['fetcher', 'target'],
  events: {
    onReady: 'fovea-ready',
    onSlideChange: 'fovea-slide-change',
    onMarked: 'fovea-marked',
    onError: 'fovea-error',
  },
});

definePowerpointElement();
