export { TextViewer } from './TextViewer.jsx';
export { LineViewer } from './LineViewer.jsx';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'text',
  mimeTypes: ['text/plain'],
  extensions: ['txt', 'log'],
};
