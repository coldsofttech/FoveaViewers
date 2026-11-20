/* eslint-disable security/detect-object-injection -- every key is a prop name written in a viewer's own code (`required`, a callback name) or a key of the props object, never text from a file. */
import { createH } from './h.js';

/**
 * @typedef {object} ViewerController
 * @property {HTMLElement} element The viewer's root element: a child of the container.
 * @property {(next: Record<string, any>) => void} update Applies changed props. Props that are not
 *   given keep their value, and a value equal to the current one does nothing.
 * @property {() => void} destroy Stops loading and removes everything the viewer added. Safe to
 *   call more than once.
 */

/**
 * @typedef {object} ShellOptions
 * @property {string[]} [required] Props that must be given, or the factory throws a `TypeError`.
 *   Defaults to `['source']`.
 * @property {string} [className] Class for the root element (usually a CSS module class).
 * @property {string} [tag] Tag of the root element. Defaults to `div`.
 */

/**
 * @typedef {object} Shell
 * @property {HTMLElement} root The element the viewer draws into, appended to the container.
 * @property {ReturnType<typeof createH>} h Builds elements for the container's document.
 * @property {Record<string, any>} props The current props.
 * @property {boolean} alive False once the viewer has been destroyed.
 * @property {(handler: (changed: string[], props: Record<string, any>) => void) => void} onUpdate
 *   Sets the function `update` calls with the names of the props that changed.
 * @property {(name: string, ...args: unknown[]) => void} emit Calls the current callback prop of
 *   that name, unless the viewer has been destroyed.
 * @property {(task: (signal: AbortSignal) => Promise<any>, handlers?: { onResult?: (value: any) => void, onError?: (error: Error) => void }) => Promise<void>} load
 *   Runs a load. Starting another one cancels this one, and the result of a cancelled or
 *   destroyed load is dropped: neither handler runs.
 * @property {() => void} cancel Cancels the load in progress and drops its result.
 * @property {(fn: () => void) => void} cleanup Runs `fn` when the viewer is destroyed.
 * @property {ViewerController} api The controller to return from the factory.
 */

/**
 * Reports an error from a host callback without breaking the viewer.
 *
 * @param {unknown} error
 */
function report(error) {
  if (typeof reportError === 'function') reportError(error);
  else {
    setTimeout(() => {
      throw error;
    }, 0);
  }
}

/**
 * The machinery every controller shares, so the rules of the contract (see
 * docs/design/vanilla-and-element.md) are written once:
 *
 * - the root element is the only thing added to the container, and `destroy` removes it;
 * - `destroy` is idempotent and `update` after it does nothing;
 * - loads are cancellable and stale results are dropped;
 * - callbacks are read when called, so replacing one never reloads, and none runs after `destroy`.
 *
 * @param {HTMLElement | ShadowRoot} container Where the viewer draws. A shadow root works.
 * @param {Record<string, any>} props The viewer's props.
 * @param {ShellOptions} [options]
 * @returns {Shell}
 */
export function createShell(container, props, options = {}) {
  const { required = ['source'], className = '', tag = 'div' } = options;
  if (!container || typeof container.append !== 'function' || !container.ownerDocument) {
    throw new TypeError('A container element is required.');
  }
  if (!props || typeof props !== 'object') throw new TypeError('Props are required.');
  for (const name of required) {
    if (props[name] === undefined || props[name] === null) {
      throw new TypeError(`The "${name}" prop is required.`);
    }
  }

  const doc = container.ownerDocument;
  const root = doc.createElement(tag);
  root.setAttribute('data-fovea-root', '');
  if (className) root.className = className;
  container.append(root);

  let current = { ...props };
  let alive = true;
  let loadId = 0;
  /** @type {AbortController | null} */
  let controller = null;
  /** @type {Array<() => void>} */
  const cleanups = [];
  /** @type {((changed: string[], props: Record<string, any>) => void) | null} */
  let handler = null;

  /** @type {Shell} */
  const shell = {
    root,
    h: createH(doc),
    get props() {
      return current;
    },
    get alive() {
      return alive;
    },
    onUpdate(fn) {
      handler = fn;
    },
    emit(name, ...args) {
      const callback = current[name];
      if (!alive || typeof callback !== 'function') return;
      try {
        callback(...args);
      } catch (error) {
        report(error);
      }
    },
    load(task, handlers = {}) {
      controller?.abort();
      const own = new AbortController();
      controller = own;
      const id = ++loadId;
      const live = () => alive && id === loadId;
      return Promise.resolve()
        .then(() => (live() ? task(own.signal) : undefined))
        .then(
          (value) => {
            if (live()) handlers.onResult?.(value);
          },
          (error) => {
            if (live())
              handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
          },
        );
    },
    cancel() {
      controller?.abort();
      controller = null;
      loadId++;
    },
    cleanup(fn) {
      cleanups.push(fn);
    },
    api: {
      element: root,
      update(next) {
        if (!alive || !next || typeof next !== 'object') return;
        const changed = Object.keys(next).filter((name) => !Object.is(current[name], next[name]));
        if (changed.length === 0) return;
        current = { ...current, ...next };
        handler?.(changed, current);
      },
      destroy() {
        if (!alive) return;
        alive = false;
        shell.cancel();
        for (const fn of cleanups.reverse()) {
          try {
            fn();
          } catch (error) {
            report(error);
          }
        }
        root.remove();
      },
    },
  };
  return shell;
}
