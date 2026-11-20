import { useEffect, useRef } from 'react';

/**
 * @typedef {import('./vanilla/shell.js').ViewerController} ViewerController
 */

/**
 * Runs a viewer's vanilla controller from a React component, so the component is a thin wrapper
 * and the viewer's rendering exists once. The controller is created when the component mounts and
 * destroyed when it unmounts, and the props are passed to `update` after every render (the
 * controller ignores the ones that did not change).
 *
 * Returns the ref for the element the viewer draws into. Give that element a height.
 *
 * ```jsx
 * export function TextViewer(props) {
 *   const host = useController(createTextViewer, props);
 *   return <div ref={host} style={{ height: '100%' }} />;
 * }
 * ```
 *
 * @template {Record<string, any>} P
 * @param {(container: HTMLElement, props: P) => ViewerController} create
 * @param {P} props
 * @returns {import('react').RefObject<HTMLDivElement | null>}
 */
export function useController(create, props) {
  const host = useRef(/** @type {HTMLDivElement | null} */ (null));
  const controller = useRef(/** @type {ViewerController | null} */ (null));

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const made = create(element, props);
    controller.current = made;
    return () => {
      made.destroy();
      controller.current = null;
    };
    // The controller is made once per mount; later props reach it through `update` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create]);

  useEffect(() => {
    controller.current?.update(props);
  });

  return host;
}
