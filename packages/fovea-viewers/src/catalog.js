/* Which files each viewer opens, and the functions that pick a viewer for a file. Nothing here imports
   a viewer or React, so both the React and the vanilla entry points can share it. */
/**
 * @typedef {object} ViewerEntry
 * @property {string} id Viewer id, for example `markdown`.
 * @property {string[]} mimeTypes MIME types the viewer opens.
 * @property {string[]} extensions File extensions the viewer opens, lowercase and without the dot.
 */

const OOXML = 'application/vnd.openxmlformats-officedocument';

// The mime types and extensions mirror each viewer package's `meta`. When two viewers open the same
// extension (`.log` is in both `code` and `text`), the first one here is used.
/** @type {ViewerEntry[]} */
export const catalog = [
  {
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
    extensions: [
      'css',
      'js',
      'mjs',
      'cjs',
      'ts',
      'mts',
      'cts',
      'tsx',
      'jsx',
      'json',
      'jsonc',
      'geojson',
      'ndjson',
      'jsonl',
      'ipynb',
      'yaml',
      'yml',
      'toml',
      'ini',
      'cfg',
      'xml',
      'xsd',
      'xsl',
      'xslt',
      'plist',
      'sql',
      'rst',
      'log',
      'c',
      'h',
      'cpp',
      'cc',
      'cxx',
      'hpp',
      'hh',
      'hxx',
      'cs',
      'java',
      'go',
      'rs',
      'py',
      'pyw',
      'php',
      'rb',
      'sh',
      'bash',
      'zsh',
      'ps1',
      'psm1',
    ],
  },
  {
    id: 'email',
    mimeTypes: ['message/rfc822'],
    extensions: ['eml'],
  },
  {
    id: 'excel',
    mimeTypes: [`${OOXML}.spreadsheetml.sheet`, 'application/vnd.ms-excel.sheet.macroEnabled.12'],
    extensions: ['xlsx', 'xlsm'],
  },
  {
    id: 'feed',
    mimeTypes: ['application/rss+xml', 'application/atom+xml'],
    extensions: ['rss', 'atom'],
  },
  {
    id: 'html',
    mimeTypes: ['text/html'],
    extensions: ['html', 'htm'],
  },
  {
    id: 'image',
    mimeTypes: [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/avif',
    ],
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'],
  },
  {
    id: 'markdown',
    mimeTypes: ['text/markdown'],
    extensions: ['md', 'markdown'],
  },
  {
    id: 'pdf',
    mimeTypes: ['application/pdf'],
    extensions: ['pdf'],
  },
  {
    id: 'powerpoint',
    mimeTypes: [
      `${OOXML}.presentationml.presentation`,
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    ],
    extensions: ['pptx', 'pptm'],
  },
  {
    id: 'table',
    mimeTypes: ['text/csv', 'text/tab-separated-values'],
    extensions: ['csv', 'tsv'],
  },
  {
    id: 'text',
    mimeTypes: ['text/plain'],
    extensions: ['txt', 'log'],
  },
  {
    id: 'word',
    mimeTypes: [
      `${OOXML}.wordprocessingml.document`,
      'application/vnd.ms-word.document.macroEnabled.12',
    ],
    extensions: ['docx', 'docm'],
  },
];

/**
 * The name a viewer package exports its component under, for example `MarkdownViewer`.
 *
 * @param {string} id Viewer id.
 * @returns {string}
 */
export const componentName = (id) => `${id[0].toUpperCase()}${id.slice(1)}Viewer`;

/**
 * The name a viewer package's `/vanilla` entry exports its function under, for example
 * `createMarkdownViewer`.
 *
 * @param {string} id Viewer id.
 * @returns {string}
 */
export const createName = (id) => `create${id[0].toUpperCase()}${id.slice(1)}Viewer`;

/**
 * Lowercases a MIME type and drops parameters such as `; charset=utf-8`.
 *
 * @param {string} mime
 * @returns {string}
 */
const normalizeMime = (mime) => mime.split(';')[0].trim().toLowerCase();

/**
 * Returns the extension of a file name or URL, lowercase and without the dot.
 *
 * @param {string} name
 * @returns {string}
 */
const extensionOf = (name) => {
  const path = name.split(/[?#]/)[0];
  const dot = path.lastIndexOf('.');
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return dot > slash ? path.slice(dot + 1).toLowerCase() : '';
};

/**
 * Finds the viewer for a file, MIME type, file name or URL. The MIME type wins over the extension.
 *
 * @param {File | Blob | string} input A File or Blob, a MIME type, or a file name or URL.
 * @returns {string | null} The viewer id, or `null` when no viewer matches.
 */
export function resolve(input) {
  let mime = '';
  let name = '';
  if (typeof input === 'string') {
    // A string is a MIME type when one matches, otherwise a file name or URL.
    mime = input;
    name = input;
  } else if (input) {
    mime = input.type ?? '';
    name = /** @type {File} */ (input).name ?? '';
  }

  const type = normalizeMime(mime);
  const byMime = type && catalog.find((entry) => entry.mimeTypes.includes(type));
  if (byMime) return byMime.id;

  const extension = extensionOf(name);
  const byExtension = extension && catalog.find((entry) => entry.extensions.includes(extension));
  return byExtension ? byExtension.id : null;
}
