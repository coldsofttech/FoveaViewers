import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createTextViewer } from './vanilla/createTextViewer.js';

/**
 * Registers `<fovea-text>`, the text viewer as a Web Component. Importing this file registers it;
 * call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `line-height`. Properties: those, plus
 * `source` (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher`, `target` and `theme` (also an object
 * of colours). Events: `fovea-ready` (`detail.lineCount`) and `fovea-error` (`detail` is the
 * `Error`).
 */
export const defineTextElement = defineViewerElement({
  tag: 'fovea-text',
  create: createTextViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    'line-height': ['lineHeight', 'number'],
  },
  properties: ['fetcher', 'target'],
  events: { onReady: 'fovea-ready', onError: 'fovea-error' },
});

defineTextElement();
