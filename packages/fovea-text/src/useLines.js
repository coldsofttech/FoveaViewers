import { useMemo } from 'react';
import { useText } from '@coldsofttech/fovea-viewers/core';
import { splitLines } from './splitLines.js';

export { splitLines };

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

/**
 * Loads a source and reads it as text, one string per line.
 *
 * @param {ViewerSource | null | undefined} source
 * @param {ViewerFetcher} [fetcher]
 * @returns {LinesState}
 */
export function useLines(source, fetcher) {
  const { status, text, error } = useText(source, fetcher);
  const lines = useMemo(() => (text === null ? null : splitLines(text)), [text]);
  return { status, lines, error };
}
