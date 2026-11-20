import { createHtmlFrame, createShell, loadSource } from '@coldsofttech/fovea-viewers/core/vanilla';
import { convertDocument } from '../convert.js';
import styles from '../WordViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../convert.js').ConversionMessage} ConversionMessage
 */

/**
 * @typedef {object} WordViewerProps
 * @property {ViewerSource} source The document: a URL, a Blob or File, or an ArrayBuffer (`.docx`
 *   or `.docm`; macros are never run).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {'none' | 'window'} [links] What a click on a link in the document does. `none` (the
 *   default) does nothing, `window` opens http(s) and mailto links in a new window.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link is
 *   clicked, instead of doing what `links` says.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to scroll to and
 *   mark in the document.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found
 *   (`null`: there is no target).
 * @property {string} [label] The accessible name. Defaults to `Word document`.
 * @property {(info: { messages: ConversionMessage[] }) => void} [onReady] Called when the document
 *   has been read, with what could not be shown as it is in the file.
 * @property {(messages: ConversionMessage[]) => void} [onWarnings] Called when the document has
 *   something that could not be shown as it is, for example a style that has no match.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/**
 * A viewer for a Word document, drawn into a container: its text, headings, lists, tables, links
 * and pictures, shown in a frame that lets nothing in unless the host allows it. Fonts, page
 * layout, headers and footers are not kept.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {WordViewerProps} props
 * @returns {ViewerController}
 */
export function createWordViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;

  /** @type {import('../convert.js').ConvertedDocument | null} */
  let page = null;
  /** @type {Error | null} */
  let error = null;
  /** @type {HTMLElement[]} */
  let messages = [];

  const frame = createHtmlFrame(root, frameProps());

  function frameProps() {
    const { links = 'none', label = 'Word document', onNavigate, target } = shell.props;
    return {
      html: page?.html ?? null,
      links,
      onNavigate: onNavigate
        ? (/** @type {string} */ href, /** @type {MouseEvent} */ event) =>
            shell.emit('onNavigate', href, event)
        : undefined,
      target,
      label,
      onMarked: (/** @type {boolean | null} */ found) => shell.emit('onMarked', found),
    };
  }

  function render() {
    const loading = !error && !page;
    root.setAttribute('aria-busy', String(loading));
    for (const message of messages) message.remove();
    messages = [];
    if (loading) messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (error) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The document could not be read: ${error.message}`,
        ),
      );
    }
    root.prepend(...messages);
    frame.update(frameProps());
  }

  function reload() {
    page = null;
    error = null;
    render();
    shell.load(
      async (signal) => {
        const blob = await loadSource(shell.props.source, { fetcher: shell.props.fetcher, signal });
        return convertDocument(blob);
      },
      {
        onResult(converted) {
          page = converted;
          render();
          shell.emit('onReady', { messages: converted.messages });
          if (converted.messages.length > 0) shell.emit('onWarnings', converted.messages);
        },
        onError(failure) {
          error = failure;
          render();
          shell.emit('onError', failure);
        },
      },
    );
  }

  shell.cleanup(() => frame.destroy());
  reload();
  shell.onUpdate((changed) => {
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else frame.update(frameProps());
  });
  return shell.api;
}
