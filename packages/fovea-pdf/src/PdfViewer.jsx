import { useController } from '@coldsofttech/fovea-viewers/core';
import { createPdfViewer } from './vanilla/createPdfViewer.js';

/**
 * @typedef {import('./vanilla/createPdfViewer.js').PdfViewerProps} PdfViewerProps
 */

/**
 * A viewer for a PDF: its pages one after another, drawn as they come into view, with text that
 * can be selected, zoom, fit, turning, page numbers, an outline, passwords and find-and-mark. The
 * drawing is done by `createPdfViewer` (see `@coldsofttech/fovea-pdf/vanilla`); this component
 * runs it.
 *
 * @param {PdfViewerProps} props
 */
export function PdfViewer(props) {
  const host = useController(createPdfViewer, props);
  return <div ref={host} style={{ height: '100%' }} />;
}
