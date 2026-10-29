// Imports every installed viewer and its style sheet, as an app would, so the build checks that each
// package and its files resolve and bundle.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Viewer } from '@coldsofttech/fovea-viewers';
import { CodeViewer } from '@coldsofttech/fovea-code';
import { EmailViewer } from '@coldsofttech/fovea-email';
import { ExcelViewer } from '@coldsofttech/fovea-excel';
import { FeedViewer } from '@coldsofttech/fovea-feed';
import { HtmlViewer } from '@coldsofttech/fovea-html';
import { ImageViewer } from '@coldsofttech/fovea-image';
import { MarkdownViewer } from '@coldsofttech/fovea-markdown';
import { PdfViewer } from '@coldsofttech/fovea-pdf';
import { PowerpointViewer } from '@coldsofttech/fovea-powerpoint';
import { TableViewer } from '@coldsofttech/fovea-table';
import { TextViewer } from '@coldsofttech/fovea-text';
import { WordViewer } from '@coldsofttech/fovea-word';
import '@coldsofttech/fovea-email/style.css';
import '@coldsofttech/fovea-excel/style.css';
import '@coldsofttech/fovea-feed/style.css';
import '@coldsofttech/fovea-html/style.css';
import '@coldsofttech/fovea-image/style.css';
import '@coldsofttech/fovea-markdown/style.css';
import '@coldsofttech/fovea-pdf/style.css';
import '@coldsofttech/fovea-powerpoint/style.css';
import '@coldsofttech/fovea-table/style.css';
import '@coldsofttech/fovea-text/style.css';
import '@coldsofttech/fovea-word/style.css';

// Keeps the imports from being dropped.
window.viewers = [
  CodeViewer,
  EmailViewer,
  ExcelViewer,
  FeedViewer,
  HtmlViewer,
  ImageViewer,
  MarkdownViewer,
  PdfViewer,
  PowerpointViewer,
  TableViewer,
  TextViewer,
  WordViewer,
];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div style={{ height: '100vh' }}>
      <Viewer source="/samples/sample.md" />
    </div>
  </StrictMode>,
);
