import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createHtmlViewer } from './vanilla/createHtmlViewer.js';

// The addresses a click on a link is allowed to follow.
const FOLLOW = /^(https?:|mailto:)/i;

/**
 * Registers `<fovea-html>`, the HTML viewer as a Web Component. Importing this file registers it;
 * call this to register it again under another tag.
 *
 * Attributes: `src`, `label`, `links` (`none`, `viewer` or `window`), `allow-images`,
 * `allow-styles` and `allow-scripts`. Properties: those, plus `source` (a URL, `Blob`, `File` or
 * `ArrayBuffer`), `fetcher` and `target`. Events: `fovea-ready` (`detail.allowScripts`),
 * `fovea-marked` (`detail` is whether the target was found, or `null`), `fovea-error` (`detail` is
 * the `Error`) and `fovea-navigate` (`detail` has `href` and the click `event`). A link click fires
 * `fovea-navigate`; call `preventDefault()` on it to handle the link yourself, or leave it and
 * `links` decides.
 */
export const defineHtmlElement = defineViewerElement({
  tag: 'fovea-html',
  create: createHtmlViewer,
  css,
  attributes: {
    src: 'source',
    label: 'label',
    links: 'links',
    'allow-images': ['allowImages', 'boolean'],
    'allow-styles': ['allowStyles', 'boolean'],
    'allow-scripts': ['allowScripts', 'boolean'],
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
      // The frame has already held the click back, so what `links` says is done here.
      fallback: (host, href, event) => {
        const how = /** @type {any} */ (host).links ?? 'none';
        if (how === 'window' && FOLLOW.test(href)) {
          const win = host.ownerDocument.defaultView;
          win?.open(href, '_blank', 'noopener,noreferrer');
        } else if (how === 'viewer') {
          /** @type {any} */ (event).view?.location.assign(href);
        }
      },
    },
  },
});

defineHtmlElement();
