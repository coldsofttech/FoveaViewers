import { catalog, componentName, resolve } from './catalog.js';

export { componentName, resolve };

/**
 * @typedef {import('./catalog.js').ViewerEntry & { load: () => Promise<any> }} RegistryEntry
 */

// Each import is written out literally so bundlers can split every viewer into its own chunk.
/** @type {Record<string, () => Promise<any>>} */
const loaders = {
  code: () => import('@coldsofttech/fovea-code'),
  email: () => import('@coldsofttech/fovea-email'),
  excel: () => import('@coldsofttech/fovea-excel'),
  feed: () => import('@coldsofttech/fovea-feed'),
  html: () => import('@coldsofttech/fovea-html'),
  image: () => import('@coldsofttech/fovea-image'),
  markdown: () => import('@coldsofttech/fovea-markdown'),
  pdf: () => import('@coldsofttech/fovea-pdf'),
  powerpoint: () => import('@coldsofttech/fovea-powerpoint'),
  table: () => import('@coldsofttech/fovea-table'),
  text: () => import('@coldsofttech/fovea-text'),
  word: () => import('@coldsofttech/fovea-word'),
};

/** @type {RegistryEntry[]} */
export const registry = catalog.map((entry) => ({
  ...entry,
  load: loaders[entry.id],
}));

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
