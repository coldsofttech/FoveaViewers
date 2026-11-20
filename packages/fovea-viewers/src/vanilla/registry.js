import { catalog, createName, resolve } from '../catalog.js';

export { catalog as registry, createName, resolve };

// Each import is written out literally so bundlers can split every viewer into its own chunk. Every
// viewer has a `/vanilla` entry now; `hasVanilla` stays so a viewer that does not can say so. `css` is the CSS
// text a viewer's Web Component carries, which `createViewer` needs to style a viewer it draws
// inside a shadow root.
/** @type {Record<string, { vanilla: () => Promise<any>, css: () => Promise<any> }>} */
const loaders = {
  code: {
    vanilla: () => import('@coldsofttech/fovea-code/vanilla'),
    // The code viewer is drawn by the text viewer, so it uses the text viewer's CSS.
    css: () => import('@coldsofttech/fovea-text/css'),
  },
  email: {
    vanilla: () => import('@coldsofttech/fovea-email/vanilla'),
    css: () => import('@coldsofttech/fovea-email/css'),
  },
  feed: {
    vanilla: () => import('@coldsofttech/fovea-feed/vanilla'),
    css: () => import('@coldsofttech/fovea-feed/css'),
  },
  html: {
    vanilla: () => import('@coldsofttech/fovea-html/vanilla'),
    css: () => import('@coldsofttech/fovea-html/css'),
  },
  image: {
    vanilla: () => import('@coldsofttech/fovea-image/vanilla'),
    css: () => import('@coldsofttech/fovea-image/css'),
  },
  markdown: {
    vanilla: () => import('@coldsofttech/fovea-markdown/vanilla'),
    css: () => import('@coldsofttech/fovea-markdown/css'),
  },
  table: {
    vanilla: () => import('@coldsofttech/fovea-table/vanilla'),
    css: () => import('@coldsofttech/fovea-table/css'),
  },
  text: {
    vanilla: () => import('@coldsofttech/fovea-text/vanilla'),
    css: () => import('@coldsofttech/fovea-text/css'),
  },
  excel: {
    vanilla: () => import('@coldsofttech/fovea-excel/vanilla'),
    css: () => import('@coldsofttech/fovea-excel/css'),
  },
  pdf: {
    vanilla: () => import('@coldsofttech/fovea-pdf/vanilla'),
    css: () => import('@coldsofttech/fovea-pdf/css'),
  },
  powerpoint: {
    vanilla: () => import('@coldsofttech/fovea-powerpoint/vanilla'),
    css: () => import('@coldsofttech/fovea-powerpoint/css'),
  },
  word: {
    vanilla: () => import('@coldsofttech/fovea-word/vanilla'),
    css: () => import('@coldsofttech/fovea-word/css'),
  },
};

/**
 * Whether a viewer can be used without React yet.
 *
 * @param {string} id
 * @returns {boolean}
 */
export const hasVanilla = (id) => Object.hasOwn(loaders, id);

/**
 * Imports a viewer's `/vanilla` entry. Viewers are optional peer dependencies, so a missing one is
 * reported with an install hint instead of a raw module error.
 *
 * @param {string} id Viewer id, for example `markdown`.
 * @returns {Promise<any>} The `/vanilla` module, which exports `createMarkdownViewer` and so on.
 */
export async function loadVanilla(id) {
  if (!catalog.some((entry) => entry.id === id)) throw new Error(`Unknown viewer "${id}".`);
  if (!hasVanilla(id)) {
    throw new Error(
      `The "${id}" viewer cannot be used without React yet. Use its React component.`,
    );
  }
  try {
    // eslint-disable-next-line security/detect-object-injection -- `id` was checked against the catalog.
    return await loaders[id].vanilla();
  } catch (cause) {
    throw new Error(
      `The "${id}" viewer could not be loaded. Install it with: npm install @coldsofttech/fovea-${id}`,
      { cause },
    );
  }
}

/**
 * The CSS text of a viewer, or an empty string when it cannot be had.
 *
 * @param {string} id
 * @returns {Promise<string>}
 */
export async function loadCss(id) {
  if (!hasVanilla(id)) return '';
  try {
    // eslint-disable-next-line security/detect-object-injection -- `id` was checked just above.
    return (await loaders[id].css()).default;
  } catch {
    return '';
  }
}
