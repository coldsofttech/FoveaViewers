export { WordViewer } from './WordViewer.jsx';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'word',
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-word.document.macroEnabled.12',
  ],
  extensions: ['docx', 'docm'],
};
