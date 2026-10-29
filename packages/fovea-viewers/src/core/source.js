/**
 * @typedef {string | Blob | File | ArrayBuffer} ViewerSource
 * A URL, a Blob or File, or raw bytes.
 */

/**
 * @typedef {(url: string) => Promise<Response>} ViewerFetcher
 * Lets the host control authentication and transport for URL sources.
 */

/**
 * Reads a source into a Blob. URL sources go through `fetcher`, so the host decides how the
 * request is made. This is the only place a viewer touches the network.
 *
 * @param {ViewerSource} source
 * @param {{ fetcher?: ViewerFetcher, signal?: AbortSignal }} [options]
 * @returns {Promise<Blob>}
 */
export async function readSource(source, { fetcher, signal } = {}) {
  if (source instanceof Blob) return source;
  if (source instanceof ArrayBuffer) return new Blob([source]);
  if (typeof source !== 'string') throw new TypeError('Unsupported source type.');

  const response = await (fetcher ? fetcher(source) : fetch(source, { signal }));
  if (!response.ok) throw new Error(`Could not load the file (${response.status}).`);
  return response.blob();
}
