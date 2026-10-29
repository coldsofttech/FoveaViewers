export { EmailViewer } from './EmailViewer.jsx';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'email',
  mimeTypes: ['message/rfc822'],
  extensions: ['eml'],
};
