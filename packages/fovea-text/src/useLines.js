import { useEffect, useState } from 'react';
import { useSource } from '@coldsofttech/fovea-viewers/core';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} LinesState
 * @property {'loading' | 'ready' | 'error'} status
 * @property {string[] | null} lines The lines once `status` is `ready`.
 * @property {Error | null} error The failure once `status` is `error`.
 */

/** @type {LinesState} */
const LOADING = { status: 'loading', lines: null, error: null };

/**
 * Splits text into lines on `\n`, `\r\n` or `\r`. A final line break does not add an empty line.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Loads a source and reads it as text, one string per line.
 *
 * @param {ViewerSource | null | undefined} source
 * @param {ViewerFetcher} [fetcher]
 * @returns {LinesState}
 */
export function useLines(source, fetcher) {
  const loaded = useSource(source, fetcher);
  // Remembers which blob the lines came from, so a new source reads as loading during render.
  const [decoded, setDecoded] = useState(
    /** @type {{ blob: Blob, lines?: string[], error?: Error } | null} */ (null),
  );

  useEffect(() => {
    const blob = loaded.blob;
    if (!blob) return undefined;
    let cancelled = false;
    blob.text().then(
      (text) => {
        if (!cancelled) setDecoded({ blob, lines: splitLines(text) });
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

  if (loaded.status === 'error') return { status: 'error', lines: null, error: loaded.error };
  if (!decoded || decoded.blob !== loaded.blob) return LOADING;
  if (decoded.error) return { status: 'error', lines: null, error: decoded.error };
  return { status: 'ready', lines: decoded.lines ?? [], error: null };
}
