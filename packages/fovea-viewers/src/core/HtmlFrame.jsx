import { useController } from './useController.js';
import { createHtmlFrame } from './vanilla/htmlFrame.js';

/**
 * @typedef {import('./vanilla/htmlFrame.js').HtmlFrameProps} HtmlFrameProps
 */

/**
 * A web page in a frame that lets nothing in unless the host allows it: no pictures, styles or
 * fonts from the web, no scripts, and links that do nothing. It can scroll to and mark some words.
 * It fills its parent. The work is done by `createHtmlFrame` (see
 * `@coldsofttech/fovea-viewers/core/vanilla`); this component runs it.
 *
 * @param {HtmlFrameProps} props
 */
export function HtmlFrame(props) {
  const host = useController(createHtmlFrame, props);
  // The wrapper takes no space, so the frame fills the parent as it did before.
  return <div ref={host} style={{ display: 'contents' }} />;
}
