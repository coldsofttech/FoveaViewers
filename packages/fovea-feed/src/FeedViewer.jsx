import { useController } from '@coldsofttech/fovea-viewers/core';
import { createFeedViewer } from './vanilla/createFeedViewer.js';

/**
 * @typedef {import('./vanilla/createFeedViewer.js').FeedViewerProps} FeedViewerProps
 */

/**
 * A reader for an RSS or Atom feed: its title and details, then each entry as a card with its
 * title, author, date, categories, text, attachments and link. Entries are shown a page at a time.
 * The drawing is done by `createFeedViewer` (see `@coldsofttech/fovea-feed/vanilla`); this
 * component runs it.
 *
 * @param {FeedViewerProps} props
 */
export function FeedViewer(props) {
  const host = useController(createFeedViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
