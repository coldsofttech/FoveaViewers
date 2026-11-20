import { useController } from '@coldsofttech/fovea-viewers/core';
import { createPowerpointViewer } from './vanilla/createPowerpointViewer.js';

/**
 * @typedef {import('./vanilla/createPowerpointViewer.js').PowerpointViewerProps} PowerpointViewerProps
 */

/**
 * A viewer for a PowerPoint presentation: the slide with its text, tables and pictures placed as in
 * the file, buttons and keys to move between slides, small slides to choose from, and speaker
 * notes. Animations, charts, SmartArt and theme colours and fonts are not shown. The drawing is
 * done by `createPowerpointViewer` (see `@coldsofttech/fovea-powerpoint/vanilla`); this component
 * runs it.
 *
 * @param {PowerpointViewerProps} props
 */
export function PowerpointViewer(props) {
  const host = useController(createPowerpointViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
