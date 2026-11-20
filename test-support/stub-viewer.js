// A minimal viewer built only from the shared runtime. It exists to prove the runtime, the element
// helper and the conformance suite work end to end before any real viewer is converted.
import {
  applyTheme,
  createShell,
  loadText,
} from '../packages/fovea-viewers/src/core/vanilla/index.js';
import { defineViewerElement } from '../packages/fovea-viewers/src/core/element/index.js';

/**
 * @param {HTMLElement | ShadowRoot} container
 * @param {Record<string, any>} props
 */
export function createStubViewer(container, props) {
  const shell = createShell(container, props, { className: 'stub' });
  const { root, h } = shell;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', props.label ?? 'Stub');
  applyTheme(root, props.theme);

  const show = (/** @type {HTMLElement} */ node) => root.replaceChildren(node);

  const reload = () => {
    show(h('p', { role: 'status' }, 'Loading…'));
    shell.load((signal) => loadText(shell.props.source, { fetcher: shell.props.fetcher, signal }), {
      onResult(text) {
        show(h('pre', null, text));
        shell.emit('onReady', { length: text.length });
      },
      onError(error) {
        show(h('p', { role: 'alert' }, error.message));
        shell.emit('onError', error);
      },
    });
  };

  shell.onUpdate((changed) => {
    if (changed.includes('theme')) applyTheme(root, shell.props.theme);
    if (changed.includes('label')) root.setAttribute('aria-label', shell.props.label ?? 'Stub');
    if (changed.includes('source') || changed.includes('fetcher')) reload();
  });

  reload();
  return shell.api;
}

export const defineStubElement = defineViewerElement({
  tag: 'fovea-stub',
  create: createStubViewer,
  css: '[data-fovea-root]{display:block}',
  attributes: { src: 'source', theme: 'theme', label: 'label' },
  properties: ['fetcher'],
  events: { onReady: 'fovea-ready', onError: 'fovea-error' },
});
