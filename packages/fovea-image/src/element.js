import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createImageViewer } from './vanilla/createImageViewer.js';

/**
 * Registers `<fovea-image>`, the image viewer as a Web Component. Importing this file registers
 * it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `alt`, `fit` (`contain`, `width` or
 * `actual`) and `show-info` (`show-info="false"` leaves out the details). Properties: those, plus
 * `source` (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher` and `theme` (also an object of
 * colours). Events: `fovea-ready` (`detail` has `width`, `height`, `size` and `type`) and
 * `fovea-error` (`detail` is the `Error`).
 */
export const defineImageElement = defineViewerElement({
  tag: 'fovea-image',
  create: createImageViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    alt: 'alt',
    fit: 'fit',
    'show-info': ['showInfo', 'boolean'],
  },
  properties: ['fetcher'],
  events: { onReady: 'fovea-ready', onError: 'fovea-error' },
});

defineImageElement();
