/* eslint-disable security/detect-object-injection -- prop names are written in this file. */
import { createShell } from '@coldsofttech/fovea-viewers/core/vanilla';
import styles from '../TextViewer.module.css';
import { createLineView } from './lineView.js';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 */

/**
 * A line coloured in pieces: each is a kind of token (`keyword`, `string`...) or `null` for plain
 * text, and the text of the piece. The pieces make up the line.
 *
 * @typedef {Array<[string | null, string]>} LineTokens
 */

/**
 * @typedef {object} LineViewerProps
 * @property {string[] | null} [lines] The lines to show (`null` while they are being loaded).
 * @property {'loading' | 'ready' | 'error'} [status] Defaults to `ready`.
 * @property {Error | null} [error] Why the lines could not be loaded, when `status` is `error`.
 * @property {(text: string, index: number) => LineTokens | null} [tokens] Colours a line (`index`
 *   from 0). Each kind of token takes the colour of the CSS variable `--fovea-token-<kind>`.
 *   Return `null` to draw the line plain. Pass a stable function.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Text`.
 * @property {{ line: number, column?: number | null, length?: number }} [target] A line (from 1)
 *   to scroll to, and optionally the characters on it to mark (`column` from 1). Changing it
 *   scrolls again.
 * @property {number} [lineHeight] The height of every line in pixels. Defaults to 20.
 * @property {(info: { lineCount: number }) => void} [onReady] Called when the lines are shown.
 * @property {(error: Error) => void} [onError] Called when `error` is set.
 */

/** The props the view draws from. */
const VIEW_PROPS = ['lines', 'status', 'error', 'tokens', 'theme', 'label', 'target', 'lineHeight'];

/**
 * Draws lines of text with line numbers into a container. Only the lines in view are in the page,
 * so a file of hundreds of thousands of lines opens at once. Lines do not wrap; a long one scrolls
 * sideways. This is what `createTextViewer` shows once it has read a file, and what the code
 * viewer builds on.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {LineViewerProps} props
 * @returns {ViewerController}
 */
export function createLineViewer(container, props) {
  const shell = createShell(container, props, { required: [], className: styles.root });
  const view = createLineView({ root: shell.root, h: shell.h, emit: shell.emit });
  shell.cleanup(() => view.destroy());

  /** @param {Record<string, any>} from */
  const pick = (from) =>
    Object.fromEntries(VIEW_PROPS.filter((name) => name in from).map((name) => [name, from[name]]));

  view.set(pick(props));
  shell.onUpdate((changed, current) => {
    view.set(pick(Object.fromEntries(changed.map((name) => [name, current[name]]))));
  });
  return shell.api;
}
