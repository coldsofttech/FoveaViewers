export { MarkdownViewer } from './MarkdownViewer.jsx';
export { locateInSource } from './locate.js';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'markdown',
  mimeTypes: ['text/markdown'],
  extensions: ['md', 'markdown'],
};
