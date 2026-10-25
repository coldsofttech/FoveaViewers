import { useMemo } from 'react';
import { useText } from '@coldsofttech/fovea-viewers/core';

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
  const { status, text, error } = useText(source, fetcher);
  const lines = useMemo(() => (text === null ? null : splitLines(text)), [text]);
  return { status, lines, error };
}
