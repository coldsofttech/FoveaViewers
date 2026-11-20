import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createWordViewer } from './vanilla/createWordViewer.js';

// The addresses a click on a link is allowed to follow.
const FOLLOW = /^(https?:|mailto:)/i;

/**
 * Registers `<fovea-word>`, the Word document viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `label` and `links` (`none` or `window`). Properties: those, plus `source`
 * (a URL, `Blob`, `File` or `ArrayBuffer`), `fetcher` and `target`. Events: `fovea-ready`
 * (`detail.messages`), `fovea-warnings` (`detail` is the list of things that could not be shown),
 * `fovea-marked` (`detail` is whether the target was found, or `null`), `fovea-error` (`detail` is
 * the `Error`) and `fovea-navigate` (`detail` has `href` and the click `event`). A link click fires
 * `fovea-navigate`; call `preventDefault()` on it to handle the link yourself, or leave it and
 * `links` decides.
 */
export const defineWordElement = defineViewerElement({
  tag: 'fovea-word',
  create: createWordViewer,
  css,
  attributes: { src: 'source', label: 'label', links: 'links' },
  properties: ['fetcher', 'target'],
  events: {
    onReady: 'fovea-ready',
    onWarnings: 'fovea-warnings',
    onMarked: 'fovea-marked',
    onError: 'fovea-error',
    onNavigate: {
      name: 'fovea-navigate',
      cancelable: true,
      detail: (href, event) => ({ href, event }),
      fallback: (host, href) => {
        if (/** @type {any} */ (host).links === 'window' && FOLLOW.test(href)) {
          host.ownerDocument.defaultView?.open(href, '_blank', 'noopener,noreferrer');
        }
      },
    },
  },
});

defineWordElement();
