import { squash } from '@coldsofttech/fovea-viewers/core';

/** @type {WeakMap<object, Promise<string[]>>} */
const cache = new WeakMap();

/**
 * The text of every page, squashed for finding words in. Read once for each document.
 *
 * @param {import('pdfjs-dist').PDFDocumentProxy} doc
 * @returns {Promise<string[]>}
 */
export function pageTexts(doc) {
  let texts = cache.get(doc);
  if (!texts) {
    texts = (async () => {
      /** @type {string[]} */
      const all = [];
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number);
        const content = await page.getTextContent();
        all.push(squash(content.items.map((item) => ('str' in item ? item.str : '')).join(' ')));
      }
      return all;
    })();
    cache.set(doc, texts);
  }
  return texts;
}
