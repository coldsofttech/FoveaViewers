import { useEffect, useRef } from 'react';

/**
 * Keeps the latest value in a ref, so an effect can call a callback prop without re-running
 * every time the parent passes a new function.
 *
 * @template T
 * @param {T} value
 * @returns {{ current: T }}
 */
export function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
