import { useController } from '@coldsofttech/fovea-viewers/core';
import { createHtmlViewer } from './vanilla/createHtmlViewer.js';

/**
 * @typedef {import('./vanilla/createHtmlViewer.js').HtmlViewerProps} HtmlViewerProps
 */

/**
 * A web page in a frame that lets nothing in unless the host allows it: no pictures, styles or
 * fonts from the web, no scripts, and links that do nothing. It can scroll to and mark some words.
 * The drawing is done by `createHtmlViewer` (see `@coldsofttech/fovea-html/vanilla`); this
 * component runs it.
 *
 * @param {HtmlViewerProps} props
 */
export function HtmlViewer(props) {
  const host = useController(createHtmlViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
