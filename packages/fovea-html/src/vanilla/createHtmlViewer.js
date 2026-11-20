import { createHtmlFrame, createShell, loadText } from '@coldsofttech/fovea-viewers/core/vanilla';
import styles from '../HtmlViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 */

/**
 * @typedef {object} HtmlViewerProps
 * @property {ViewerSource} source The page: a URL, a Blob or File, or an ArrayBuffer (UTF-8). For a
 *   URL, it is also the address the page's relative addresses are worked out from.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {boolean} [allowImages] Let http(s) pictures load. Off by default, so only pictures
 *   inside the file (data: addresses) are shown.
 * @property {boolean} [allowStyles] Let http(s) stylesheets and fonts load. Off by default, so
 *   only the file's own `<style>` and inline styles apply.
 * @property {boolean} [allowScripts] Run the page's inline scripts. Off by default. The page then
 *   runs in a frame the viewer cannot reach into, so words cannot be marked in it.
 * @property {'none' | 'viewer' | 'window'} [links] What a click on a link does. `none` (the
 *   default) does nothing, `viewer` opens it in the viewer, and `window` opens http(s) and mailto
 *   links in a new window. Links to a place in the same page always scroll.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link to another
 *   page is clicked. When given, it replaces what `links` says.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to scroll to and
 *   mark in what the page shows.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found in
 *   what is shown (`null`: there is no target).
 * @property {string} [label] The accessible name. Defaults to `Web page`.
 * @property {(info: { allowScripts: boolean }) => void} [onReady] Called when the page has loaded.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded.
 */

/**
 * A web page in a frame that lets nothing in unless the host allows it: no pictures, styles or
 * fonts from the web, no scripts, and links that do nothing. It can scroll to and mark some words.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {HtmlViewerProps} props
 * @returns {ViewerController}
 */
export function createHtmlViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;

  /** @type {'loading' | 'ready' | 'error'} */
  let status = 'loading';
  /** @type {string | null} */
  let text = null;
  /** @type {HTMLElement | null} */
  let message = null;

  const frame = createHtmlFrame(root, frameProps());

  function frameProps() {
    const { source, allowImages, allowStyles, allowScripts, links, onNavigate, target, label } =
      shell.props;
    return {
      html: text,
      base: typeof source === 'string' ? source : undefined,
      allowImages,
      allowStyles,
      allowScripts,
      links,
      // The frame calls these; they reach the host's current callbacks.
      onNavigate: onNavigate
        ? (/** @type {string} */ href, /** @type {MouseEvent} */ event) =>
            shell.emit('onNavigate', href, event)
        : undefined,
      target,
      label,
      onMarked: (/** @type {boolean | null} */ found) => shell.emit('onMarked', found),
      onReady: (/** @type {{ allowScripts: boolean }} */ info) => shell.emit('onReady', info),
    };
  }

  /** @param {Error | null} error */
  function show(error) {
    message?.remove();
    message = null;
    if (status === 'loading') {
      message = h('p', { role: 'status', class: styles.message }, 'Loading…');
    } else if (status === 'error') {
      message = h(
        'p',
        { role: 'alert', class: styles.message },
        `The page could not be loaded: ${error?.message ?? ''}`,
      );
    }
    if (message) root.prepend(message);
    frame.update(frameProps());
  }

  function reload() {
    status = 'loading';
    text = null;
    show(null);
    shell.load((signal) => loadText(shell.props.source, { fetcher: shell.props.fetcher, signal }), {
      onResult(loaded) {
        status = 'ready';
        text = loaded;
        show(null);
      },
      onError(error) {
        status = 'error';
        show(error);
        shell.emit('onError', error);
      },
    });
  }

  shell.cleanup(() => frame.destroy());
  reload();
  shell.onUpdate((changed) => {
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else frame.update(frameProps());
  });
  return shell.api;
}
