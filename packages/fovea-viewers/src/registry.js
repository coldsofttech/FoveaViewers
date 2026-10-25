/**
 * @typedef {object} ViewerEntry
 * @property {string} id Viewer id, for example `markdown`.
 * @property {string[]} mimeTypes MIME types the viewer opens.
 * @property {string[]} extensions File extensions the viewer opens, lowercase and without the dot.
 * @property {() => Promise<any>} load Imports the viewer package.
 */

const OOXML = 'application/vnd.openxmlformats-officedocument';

// Each import is written out literally so bundlers can split every viewer into its own chunk.
// The mime types and extensions mirror each viewer package's `meta`. When two viewers open the same
// extension (`.log` is in both `code` and `text`), the first one here is used.
/** @type {ViewerEntry[]} */
export const registry = [
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
    load: () => import('@coldsofttech/fovea-code'),
  },
  {
    id: 'email',
    mimeTypes: ['message/rfc822', 'application/vnd.ms-outlook'],
    extensions: ['eml', 'msg'],
    load: () => import('@coldsofttech/fovea-email'),
  },
  {
    id: 'excel',
    mimeTypes: [`${OOXML}.spreadsheetml.sheet`, 'application/vnd.ms-excel'],
    extensions: ['xlsx', 'xls'],
    load: () => import('@coldsofttech/fovea-excel'),
  },
  {
    id: 'feed',
    mimeTypes: ['application/rss+xml', 'application/atom+xml'],
    extensions: ['rss', 'atom'],
    load: () => import('@coldsofttech/fovea-feed'),
  },
  {
    id: 'html',
    mimeTypes: ['text/html'],
    extensions: ['html', 'htm'],
    load: () => import('@coldsofttech/fovea-html'),
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
    load: () => import('@coldsofttech/fovea-image'),
  },
  {
    id: 'markdown',
    mimeTypes: ['text/markdown'],
    extensions: ['md', 'markdown'],
    load: () => import('@coldsofttech/fovea-markdown'),
  },
  {
    id: 'pdf',
    mimeTypes: ['application/pdf'],
    extensions: ['pdf'],
    load: () => import('@coldsofttech/fovea-pdf'),
  },
  {
    id: 'powerpoint',
    mimeTypes: [`${OOXML}.presentationml.presentation`],
    extensions: ['pptx'],
    load: () => import('@coldsofttech/fovea-powerpoint'),
  },
  {
    id: 'table',
    mimeTypes: ['text/csv', 'text/tab-separated-values'],
    extensions: ['csv', 'tsv'],
    load: () => import('@coldsofttech/fovea-table'),
  },
  {
    id: 'text',
    mimeTypes: ['text/plain'],
    extensions: ['txt', 'log'],
    load: () => import('@coldsofttech/fovea-text'),
  },
  {
    id: 'word',
    mimeTypes: [`${OOXML}.wordprocessingml.document`],
    extensions: ['docx'],
    load: () => import('@coldsofttech/fovea-word'),
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
  const byMime = type && registry.find((entry) => entry.mimeTypes.includes(type));
  if (byMime) return byMime.id;

  const extension = extensionOf(name);
  const byExtension = extension && registry.find((entry) => entry.extensions.includes(extension));
  return byExtension ? byExtension.id : null;
}

/**
 * Imports a viewer package. Viewers are optional peer dependencies, so a missing one is reported
 * with an install hint instead of a raw module error.
 *
 * @param {string} id Viewer id, for example `markdown`.
 * @returns {Promise<any>} The viewer package module.
 */
export async function load(id) {
  const entry = registry.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown viewer "${id}".`);
  try {
    return await entry.load();
  } catch (cause) {
    throw new Error(
      `The "${id}" viewer could not be loaded. Install it with: npm install @coldsofttech/fovea-${id}`,
      { cause },
    );
  }
}
