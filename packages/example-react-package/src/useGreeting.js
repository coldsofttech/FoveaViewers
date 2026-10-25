import { useMemo } from 'react';

/**
 * Builds a greeting for the given name.
 *
 * @param {string} name Who to greet.
 * @returns {string} The greeting.
 */
export function useGreeting(name) {
  return useMemo(() => `Hello, ${name}!`, [name]);
}
