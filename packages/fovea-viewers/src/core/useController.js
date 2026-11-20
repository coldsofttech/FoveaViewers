/* eslint-disable security/detect-object-injection -- the keys are the names of props the host passed, only copied or cleared. */
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
  // A controller whose effect was cleaned up and may be wanted again straight away.
  const spare = useRef(
    /** @type {{ made: ViewerController, create: unknown, element: HTMLElement } | null} */ (null),
  );

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    // React's StrictMode (and a fast refresh) cleans an effect up and runs it again at once. The
    // controller is kept for that moment instead of being destroyed and made again, so what a
    // parent has already done to its DOM survives, and a file is not loaded twice.
    const kept = spare.current;
    spare.current = null;
    const made =
      kept && kept.create === create && kept.element === element
        ? kept.made
        : create(element, props);
    controller.current = made;
    return () => {
      controller.current = null;
      // When the component really goes, React has already taken its element out of the page, and
      // the controller goes with it at once. Only a clean-up with the element still in the page is
      // StrictMode's, and the controller is kept for the effect that follows it.
      if (!element.isConnected) {
        made.destroy();
        return;
      }
      const mine = { made, create, element };
      spare.current = mine;
      queueMicrotask(() => {
        if (spare.current === mine) {
          spare.current = null;
          made.destroy();
        }
      });
    };
    // The controller is made once per mount; later props reach it through `update` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create]);

  // A prop that is no longer given is the same as one set to `undefined`.
  const given = useRef(/** @type {string[]} */ ([]));
  useEffect(() => {
    const next = /** @type {Record<string, any>} */ ({ ...props });
    for (const name of given.current) if (!(name in props)) next[name] = undefined;
    given.current = Object.keys(props);
    controller.current?.update(/** @type {Partial<P>} */ (next));
  });

  return host;
}
