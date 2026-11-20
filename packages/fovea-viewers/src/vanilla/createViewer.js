/* eslint-disable security/detect-object-injection -- the keys are the names of the props the host passed, and they are only copied. */
import { createShell } from '../core/vanilla/shell.js';
import { createName, loadCss, loadVanilla, resolve } from './registry.js';

/**
 * @typedef {import('../core/types.js').ViewerProps & { type?: string, options?: Record<string, any> } & Record<string, any>} AutoViewerProps
 */

/** The CSS already put in each shadow root, so a viewer's CSS is added once however many open. */
const styled = new WeakMap();

/**
 * Puts CSS in a shadow root, once, when the viewer is drawn inside one. Outside a shadow root the
 * page's own `style.css` imports do the work.
 *
 * @param {Node} root The viewer's root element.
 * @param {string} css
 */
function addStyles(root, css) {
  const scope = root.getRootNode();
  if (!css || !(scope instanceof ShadowRoot)) return;
  /** @type {Set<string>} */
  const seen = styled.get(scope) ?? new Set();
  styled.set(scope, seen);
  if (seen.has(css)) return;
  seen.add(css);
  if ('adoptedStyleSheets' in scope && typeof CSSStyleSheet !== 'undefined') {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    scope.adoptedStyleSheets = [...scope.adoptedStyleSheets, sheet];
  } else {
    const style = scope.ownerDocument.createElement('style');
    style.textContent = css;
    scope.append(style);
  }
}

/**
 * Opens a file in the matching viewer, loading that viewer only when it is needed. The viewer is
 * picked from `type`, or from the file name, URL or MIME type of `source`. Any other props are
 * passed to the viewer, and so is everything in `options`.
 *
 * Only the viewers that have a `/vanilla` entry can be picked so far.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {AutoViewerProps} props
 * @returns {import('../core/vanilla/shell.js').ViewerController}
 */
export function createViewer(container, props) {
  const shell = createShell(container, props);
  const { root, h } = shell;
  // The viewer inside is the viewer; this element only holds it.
  root.style.height = '100%';

  /** @type {import('../core/vanilla/shell.js').ViewerController | null} */
  let inner = null;
  let innerId = '';
  /** @type {string[]} */
  let given = [];
  /** @type {HTMLElement | null} */
  let message = null;
  /** @type {Error | null} */
  let failed = null;

  /** The props the chosen viewer gets: everything but `type` and `options`, and the options. */
  function innerProps() {
    const rest = { ...shell.props };
    delete rest.type;
    delete rest.options;
    return { ...rest, ...shell.props.options };
  }

  /** @param {'status' | 'alert' | null} role @param {string} text */
  function say(role, text) {
    message?.remove();
    message = null;
    if (!role) return;
    message = h('p', { role }, text);
    root.prepend(message);
  }

  /** @param {Error} error */
  function fail(error) {
    inner?.destroy();
    inner = null;
    innerId = '';
    say('alert', error.message);
    if (error !== failed) shell.emit('onError', error);
    failed = error;
  }

  function open() {
    const wanted = shell.props.type ?? resolve(/** @type {any} */ (shell.props.source));
    if (!wanted) {
      fail(new Error('Could not tell which viewer opens this file. Pass a "type".'));
      return;
    }
    if (inner && innerId === wanted) {
      sendProps();
      return;
    }
    inner?.destroy();
    inner = null;
    innerId = '';
    failed = null;
    say('status', 'Loading…');
    shell.load(
      async () => {
        const [module, css] = await Promise.all([loadVanilla(wanted), loadCss(wanted)]);
        const create = module[createName(wanted)];
        if (typeof create !== 'function') {
          throw new Error(`The "${wanted}" viewer does not export ${createName(wanted)}.`);
        }
        return { create, css };
      },
      {
        onResult({ create, css }) {
          say(null, '');
          addStyles(root, css);
          const props = innerProps();
          given = Object.keys(props);
          innerId = wanted;
          inner = create(root, props);
        },
        onError: fail,
      },
    );
  }

  /** Passes changed props on; a prop that is no longer given is the same as one set to undefined. */
  function sendProps() {
    if (!inner) return;
    const next = /** @type {Record<string, any>} */ ({ ...innerProps() });
    for (const name of given) if (!(name in next)) next[name] = undefined;
    given = Object.keys(next).filter((name) => next[name] !== undefined);
    inner.update(next);
  }

  shell.cleanup(() => inner?.destroy());
  shell.onUpdate((changed) => {
    if (changed.includes('type') || changed.includes('source')) {
      // A different kind of file needs a different viewer; the same kind keeps its viewer and
      // gets the new source.
      const wanted = shell.props.type ?? resolve(/** @type {any} */ (shell.props.source));
      if (inner && wanted === innerId) sendProps();
      else open();
    } else {
      sendProps();
    }
  });
  open();
  return shell.api;
}
