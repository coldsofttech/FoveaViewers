import { readSource } from '../source.js';

/**
 * @typedef {import('../source.js').ViewerSource} ViewerSource
 * @typedef {import('../source.js').ViewerFetcher} ViewerFetcher
 */

/**
 * Loads a viewer source and reads it as UTF-8 text: the function behind `useText`.
 *
 * @param {ViewerSource} source
 * @param {{ fetcher?: ViewerFetcher, signal?: AbortSignal }} [options]
 * @returns {Promise<string>}
 */
export async function loadText(source, options) {
  const blob = await readSource(source, options);
  return blob.text();
}
