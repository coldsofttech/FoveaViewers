export { PowerpointViewer } from './PowerpointViewer.jsx';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'powerpoint',
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  ],
  extensions: ['pptx', 'pptm'],
};
