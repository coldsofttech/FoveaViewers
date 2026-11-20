/* eslint-disable security/detect-object-injection -- prop names are written in this file. */
import { createShell, loadText } from '@coldsofttech/fovea-viewers/core/vanilla';
import styles from '../TextViewer.module.css';
import { splitLines } from '../splitLines.js';
import { createLineView } from './lineView.js';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 */

/**
 * @typedef {object} TextViewerExtras
 * @property {ViewerSource} source The text file: a URL, a Blob or File, or an ArrayBuffer (UTF-8).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication
 *   and transport. Defaults to `fetch`.
 */

/**
 * @typedef {Omit<import('./createLineViewer.js').LineViewerProps, 'lines' | 'status' | 'error' | 'tokens'> & TextViewerExtras} TextViewerProps
 */

/** The props passed on to the view as they are. */
const VIEW_PROPS = ['theme', 'label', 'target', 'lineHeight'];

/**
 * A read-only view of a text file with line numbers, drawn into a container. Only the lines in
 * view are in the page, so a file of hundreds of thousands of lines opens at once. Lines do not
 * wrap; a long one scrolls sideways.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {TextViewerProps} props
 * @returns {ViewerController}
 */
export function createTextViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const view = createLineView({ root: shell.root, h: shell.h, emit: shell.emit });
  shell.cleanup(() => view.destroy());

  /** @param {Record<string, any>} from */
  const pick = (from) =>
    Object.fromEntries(VIEW_PROPS.filter((name) => name in from).map((name) => [name, from[name]]));

  function reload() {
    view.set({ lines: null, status: 'loading', error: null });
    shell.load(
      async (signal) =>
        splitLines(await loadText(shell.props.source, { fetcher: shell.props.fetcher, signal })),
      {
        onResult: (lines) => view.set({ lines, status: 'ready', error: null }),
        onError: (error) => view.set({ lines: null, status: 'error', error }),
      },
    );
  }

  view.set(pick(props));
  reload();
  shell.onUpdate((changed, current) => {
    view.set(pick(Object.fromEntries(changed.map((name) => [name, current[name]]))));
    if (changed.includes('source') || changed.includes('fetcher')) reload();
  });
  return shell.api;
}
