import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { saveAttachment } from './save.js';
import { createEmailViewer } from './vanilla/createEmailViewer.js';

// The addresses a click on a link is allowed to follow.
const FOLLOW = /^(https?:|mailto:)/i;

/**
 * Registers `<fovea-email>`, the email viewer as a Web Component. Importing this file registers it;
 * call this to register it again under another tag.
 *
 * Attributes: `src`, `label`, `links` (`none` or `window`), `view` (`html` or `text`),
 * `allow-images` and `allow-styles`. Properties: those, plus `source` (a URL, `Blob`, `File` or
 * `ArrayBuffer`) and `fetcher`. Events: `fovea-ready` (`detail` is the parsed message),
 * `fovea-error` (`detail` is the `Error`), `fovea-navigate` (`detail` has `href` and the click
 * `event`) and `fovea-attachment` (`detail` is the attachment). The last two are cancelable: call
 * `preventDefault()` to handle the click yourself, or leave it and `links` decides for a link and
 * the attachment is downloaded.
 */
export const defineEmailElement = defineViewerElement({
  tag: 'fovea-email',
  create: createEmailViewer,
  css,
  attributes: {
    src: 'source',
    label: 'label',
    links: 'links',
    view: 'view',
    'allow-images': ['allowImages', 'boolean'],
    'allow-styles': ['allowStyles', 'boolean'],
  },
  properties: ['fetcher'],
  events: {
    onReady: 'fovea-ready',
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
    onAttachment: {
      name: 'fovea-attachment',
      cancelable: true,
      fallback: (host, attachment) => saveAttachment(host.ownerDocument, attachment),
    },
  },
});

defineEmailElement();
