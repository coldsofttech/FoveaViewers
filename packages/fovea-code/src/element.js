import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
// The code viewer is drawn by the text viewer, so it carries the text viewer's CSS.
import css from '@coldsofttech/fovea-text/css';
import { createCodeViewer } from './vanilla/createCodeViewer.js';

/**
 * Registers `<fovea-code>`, the source code viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `language`, `mode` (`auto`, `source` or
 * `formatted`) and `line-height`. Properties: those, plus `source` (a URL, `Blob`, `File` or
 * `ArrayBuffer`), `fetcher`, `match` and `theme` (also an object of colours). Events: `fovea-ready`
 * (`detail` has `lineCount`, `language`, `mode`, `canFormat` and `tooBig`), `fovea-located`
 * (`detail` is where `match` was found, or `null`) and `fovea-error` (`detail` is the `Error`).
 */
export const defineCodeElement = defineViewerElement({
  tag: 'fovea-code',
  create: createCodeViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    language: 'language',
    mode: 'mode',
    'line-height': ['lineHeight', 'number'],
  },
  properties: ['fetcher', 'match'],
  events: { onReady: 'fovea-ready', onLocated: 'fovea-located', onError: 'fovea-error' },
});

defineCodeElement();
