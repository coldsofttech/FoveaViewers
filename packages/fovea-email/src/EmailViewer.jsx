import { useController } from '@coldsofttech/fovea-viewers/core';
import { createEmailViewer } from './vanilla/createEmailViewer.js';

/**
 * @typedef {import('./vanilla/createEmailViewer.js').EmailViewerProps} EmailViewerProps
 */

/**
 * An email message (`.eml`): who it is from and to, its subject and date, the message itself (in a
 * frame that lets nothing in unless the host allows it), its attachments and its raw headers. The
 * drawing is done by `createEmailViewer` (see `@coldsofttech/fovea-email/vanilla`); this component
 * runs it.
 *
 * @param {EmailViewerProps} props
 */
export function EmailViewer(props) {
  const host = useController(createEmailViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
