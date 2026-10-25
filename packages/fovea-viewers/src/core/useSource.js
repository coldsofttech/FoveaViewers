import { useEffect, useState } from 'react';
import { readSource } from './source.js';

/**
 * @typedef {import('./source.js').ViewerSource} ViewerSource
 * @typedef {import('./source.js').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} SourceState
 * @property {'loading' | 'ready' | 'error'} status
 * @property {Blob | null} blob The file contents once `status` is `ready`.
 * @property {Error | null} error The failure once `status` is `error`.
 */

/** @type {SourceState} */
const LOADING = { status: 'loading', blob: null, error: null };

/**
 * Loads a viewer source and reports its state. Reloads when the source changes and ignores
 * results from a stale load.
 *
 * @param {ViewerSource | null | undefined} source
 * @param {ViewerFetcher} [fetcher]
 * @returns {SourceState}
 */
export function useSource(source, fetcher) {
  // The result remembers which request produced it, so a changed source reads as loading
  // during render without resetting state inside the effect.
  const [result, setResult] = useState(
    /** @type {{ source: unknown, fetcher: unknown, state: SourceState } | null} */ (null),
  );

  useEffect(() => {
    if (source == null) return undefined;
    const controller = new AbortController();
    const settle = (/** @type {SourceState} */ state) => {
      if (!controller.signal.aborted) setResult({ source, fetcher, state });
    };
    readSource(source, { fetcher, signal: controller.signal }).then(
      (blob) => settle({ status: 'ready', blob, error: null }),
      (error) =>
        settle({
          status: 'error',
          blob: null,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
    return () => controller.abort();
  }, [source, fetcher]);

  return result && result.source === source && result.fetcher === fetcher ? result.state : LOADING;
}
