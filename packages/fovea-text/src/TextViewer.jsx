import { LineViewer } from './LineViewer.jsx';
import { useLines } from './useLines.js';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} TextViewerExtras
 * @property {ViewerSource} source The text file: a URL, a Blob or File, or an ArrayBuffer (UTF-8).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication
 *   and transport. Defaults to `fetch`.
 */

/**
 * @typedef {Omit<import('./LineViewer.jsx').LineViewerProps, 'lines' | 'status' | 'error' | 'tokens'> & TextViewerExtras} TextViewerProps
 */

/**
 * A read-only view of a text file with line numbers. Only the lines in view are in the page, so
 * a file of hundreds of thousands of lines opens at once. Lines do not wrap; a long one scrolls
 * sideways.
 *
 * @param {TextViewerProps} props
 */
export function TextViewer({ source, fetcher, ...rest }) {
  const { status, lines, error } = useLines(source, fetcher);
  return <LineViewer {...rest} lines={lines} status={status} error={error} />;
}
