import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createMarkdownViewer } from './vanilla/createMarkdownViewer.js';

/**
 * Registers `<fovea-markdown>`, the Markdown viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label` and `allow-images`. Properties: those,
 * plus `source` (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher`, `target` and `theme` (also an
 * object of colours). Events: `fovea-ready` (`detail.blockCount`), `fovea-marked` (`detail` is
 * whether the target's words were found, or `null`), `fovea-error` (`detail` is the `Error`) and
 * `fovea-navigate` (`detail` has `href` and the click `event`). A click on a link to another page
 * fires `fovea-navigate`; call `preventDefault()` on it to handle the link yourself, or leave it
 * and the link opens in a new window.
 */
export const defineMarkdownElement = defineViewerElement({
  tag: 'fovea-markdown',
  create: createMarkdownViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    'allow-images': ['allowImages', 'boolean'],
  },
  properties: ['fetcher', 'target'],
  events: {
    onReady: 'fovea-ready',
    onMarked: 'fovea-marked',
    onError: 'fovea-error',
    onNavigate: {
      name: 'fovea-navigate',
      cancelable: true,
      detail: (href, event) => ({ href, event }),
      fallback: (host, href) => {
        host.ownerDocument.defaultView?.open(href, '_blank', 'noopener,noreferrer');
      },
    },
  },
});

defineMarkdownElement();
