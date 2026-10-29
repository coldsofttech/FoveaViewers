/**
 * @typedef {object} ConversionMessage
 * @property {'warning' | 'error'} type
 * @property {string} message What could not be shown as it is in the document.
 */

/**
 * @typedef {object} ConvertedDocument
 * @property {string} html The document as a page of markup.
 * @property {ConversionMessage[]} messages What could not be shown as it is in the document.
 */

/** @type {Promise<any> | null} */
let loading = null;

/**
 * Loads mammoth the first time a document is opened, so a page that never shows one never pays for
 * it.
 *
 * @returns {Promise<any>}
 */
function loadMammoth() {
  loading ??= import('mammoth').then((module) => module.default ?? module);
  return loading;
}

// Reading styles for the page. The document's own fonts and sizes are not kept, so the page is
// drawn in a plain, readable way.
const STYLE = `
body { box-sizing: border-box; max-width: 50rem; margin: 0 auto; padding: 24px 32px;
  font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1a1a1a; overflow-wrap: anywhere; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 0.5em; }
p { margin: 0 0 0.9em; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; margin: 0 0 1em; }
td, th { border: 1px solid #bbb; padding: 4px 8px; vertical-align: top; }
a { color: #0b57d0; }
`;

/**
 * Reads a `.docx` or `.docm` document into a page of markup. Pictures in the document are put in
 * the page as `data:` addresses, so they show without the web. Macros are never run.
 *
 * @param {Blob | ArrayBuffer} source
 * @returns {Promise<ConvertedDocument>}
 */
export async function convertDocument(source) {
  const mammoth = await loadMammoth();
  const arrayBuffer = source instanceof Blob ? await source.arrayBuffer() : source;
  const { value, messages } = await mammoth.convertToHtml({ arrayBuffer });
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${value}</body></html>`,
    messages: messages.map((/** @type {{ type: string, message: string }} */ each) => ({
      type: each.type === 'error' ? 'error' : 'warning',
      message: each.message,
    })),
  };
}
