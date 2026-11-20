import { LANGUAGES } from './languages.js';

/** Describes which files this viewer can open. */
export const meta = {
  id: 'code',
  mimeTypes: [
    'application/json',
    'application/x-ndjson',
    'application/javascript',
    'text/javascript',
    'text/css',
    'application/xml',
    'text/xml',
    'application/yaml',
    'text/yaml',
    'application/toml',
    'application/sql',
    'application/x-sh',
    'text/x-python',
    'text/x-java-source',
    'text/x-csrc',
    'text/x-c++src',
    'text/x-go',
    'text/x-rustsrc',
    'text/x-ruby',
    'application/x-httpd-php',
  ],
  extensions: Object.values(LANGUAGES).flatMap((language) => language.extensions),
};
