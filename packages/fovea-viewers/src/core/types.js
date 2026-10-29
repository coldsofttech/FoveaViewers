/**
 * @typedef {import('./source.js').ViewerSource} ViewerSource
 * @typedef {import('./source.js').ViewerFetcher} ViewerFetcher
 * @typedef {import('./theme.js').ViewerTheme} ViewerTheme
 */

/**
 * Props every viewer accepts.
 *
 * @typedef {object} ViewerProps
 * @property {ViewerSource} source The file: a URL, a Blob or File, or an ArrayBuffer.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication
 *   and transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name of the viewer.
 * @property {(info: object) => void} [onReady] Called when the file has loaded and is shown.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or shown.
 */

export {};
