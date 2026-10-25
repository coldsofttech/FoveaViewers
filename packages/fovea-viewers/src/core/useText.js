import { useEffect, useState } from 'react';
import { useSource } from './useSource.js';

/**
 * @typedef {import('./source.js').ViewerSource} ViewerSource
 * @typedef {import('./source.js').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} TextState
 * @property {'loading' | 'ready' | 'error'} status
 * @property {string | null} text The file as UTF-8 text once `status` is `ready`.
 * @property {Error | null} error The failure once `status` is `error`.
 */

/** @type {TextState} */
const LOADING = { status: 'loading', text: null, error: null };

/**
 * Loads a viewer source and reads it as UTF-8 text.
 *
 * @param {ViewerSource | null | undefined} source
 * @param {ViewerFetcher} [fetcher]
 * @returns {TextState}
 */
export function useText(source, fetcher) {
  const loaded = useSource(source, fetcher);
  // Remembers which blob the text came from, so a new source reads as loading during render.
  const [decoded, setDecoded] = useState(
    /** @type {{ blob: Blob, text?: string, error?: Error } | null} */ (null),
  );

  useEffect(() => {
    const blob = loaded.blob;
    if (!blob) return undefined;
    let cancelled = false;
    blob.text().then(
      (text) => {
        if (!cancelled) setDecoded({ blob, text });
      },
      (error) => {
        if (!cancelled) {
          setDecoded({ blob, error: error instanceof Error ? error : new Error(String(error)) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loaded.blob]);

  if (loaded.status === 'error') return { status: 'error', text: null, error: loaded.error };
  if (!decoded || decoded.blob !== loaded.blob) return LOADING;
  if (decoded.error) return { status: 'error', text: null, error: decoded.error };
  return { status: 'ready', text: decoded.text ?? '', error: null };
}
