import { defineViewerElement } from './core/element/index.js';
import { createViewer } from './vanilla/createViewer.js';

// The addresses a click on a link is allowed to follow.
const FOLLOW = /^(https?:|mailto:)/i;

/**
 * Registers `<fovea-viewer>`, which opens a file in the matching viewer. Importing this file
 * registers it; call this to register it again under another tag.
 *
 * Attributes: `src`, `type` (a viewer id such as `markdown`; worked out from the file when left
 * out), `theme` (`light` or `dark`) and `label`. Properties: those, plus `source` (a URL, `Blob`,
 * `File` or `ArrayBuffer`), `fetcher` and `options`, an object with the props of the viewer that
 * opens the file (`{ target, allowImages, pageSize }`). Events: `fovea-ready`, `fovea-error`,
 * `fovea-marked`, `fovea-located` and `fovea-navigate`, as the viewer reports them. A click on a
 * link fires `fovea-navigate`; call `preventDefault()` on it to handle the link yourself, or leave
 * it and an http(s) or mailto link opens in a new window.
 */
export const defineFoveaViewerElement = defineViewerElement({
  tag: 'fovea-viewer',
  create: createViewer,
  attributes: { src: 'source', type: 'type', theme: 'theme', label: 'label' },
  properties: ['fetcher', 'options'],
  events: {
    onReady: 'fovea-ready',
    onError: 'fovea-error',
    onMarked: 'fovea-marked',
    onLocated: 'fovea-located',
    onNavigate: {
      name: 'fovea-navigate',
      cancelable: true,
      detail: (href, event) => ({ href, event }),
      fallback: (host, href) => {
        if (FOLLOW.test(href))
          host.ownerDocument.defaultView?.open(href, '_blank', 'noopener,noreferrer');
      },
    },
  },
});

defineFoveaViewerElement();
