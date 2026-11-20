import { useController } from '@coldsofttech/fovea-viewers/core';
import { createMarkdownViewer } from './vanilla/createMarkdownViewer.js';

export { GROUP } from './vanilla/createMarkdownViewer.js';

/**
 * @typedef {import('./vanilla/createMarkdownViewer.js').MarkdownViewerProps} MarkdownViewerProps
 */

/**
 * Rendered Markdown of any size. The text is parsed once; only the groups of blocks near the
 * screen are drawn, so a very long file costs no more to scroll than a short one. It can land on a
 * source line and mark words in the block that holds it. The drawing is done by
 * `createMarkdownViewer` (see `@coldsofttech/fovea-markdown/vanilla`); this component runs it.
 *
 * @param {MarkdownViewerProps} props
 */
export function MarkdownViewer(props) {
  const host = useController(createMarkdownViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
