import { defineViewerElement } from '@coldsofttech/fovea-viewers/core/element';
import css from './style.css.js';
import { createFeedViewer } from './vanilla/createFeedViewer.js';

/**
 * Registers `<fovea-feed>`, the RSS and Atom viewer as a Web Component. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `theme` (`light` or `dark`), `label`, `rich-text`, `allow-images` and
 * `page-size`. Properties: those, plus `source` (a URL, `Blob`, `File` or `ArrayBuffer`),
 * `fetcher`, `target` and `theme` (also an object of colours). Events: `fovea-ready` (`detail` has
 * `entryCount` and `format`), `fovea-located` (`detail` is the number of the entry holding the
 * target, from 1, or `null`), `fovea-error` (`detail` is the `Error`) and `fovea-navigate` (`detail`
 * has `href` and the click `event`). A link click fires `fovea-navigate`; call `preventDefault()`
 * on it to handle the link yourself, or leave it and the link opens in a new window.
 */
export const defineFeedElement = defineViewerElement({
  tag: 'fovea-feed',
  create: createFeedViewer,
  css,
  attributes: {
    src: 'source',
    theme: 'theme',
    label: 'label',
    'rich-text': ['richText', 'boolean'],
    'allow-images': ['allowImages', 'boolean'],
    'page-size': ['pageSize', 'number'],
  },
  properties: ['fetcher', 'target'],
  events: {
    onReady: 'fovea-ready',
    onLocated: 'fovea-located',
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

defineFeedElement();
