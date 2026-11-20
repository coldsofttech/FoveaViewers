// Adapters give the conformance suite one way to drive a viewer, whichever entry point it is
// reached through: `mount(props, { host }) -> { root, update, destroy }`.
import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useRef } from 'react';
import { act } from '@testing-library/react';

/** The viewer's own factory, called with a container. */
export function vanillaAdapter(create) {
  return {
    name: 'vanilla controller',
    acceptsShadowRoot: true,
    mount(props, { host, container = host }) {
      const viewer = create(container, props);
      return { root: viewer.element, update: viewer.update, destroy: viewer.destroy };
    },
  };
}

/** The Web Component: `define()` registers it and returns its class. */
export function elementAdapter(tag, define) {
  define(tag);
  const EVENTS = { onReady: 'fovea-ready', onError: 'fovea-error' };
  return {
    name: 'web component',
    acceptsShadowRoot: false,
    mount(props, { host }) {
      const element = document.createElement(tag);
      // Callbacks are events on an element. The latest one for each is the one that runs.
      const callbacks = {};
      for (const [callback, event] of Object.entries(EVENTS)) {
        element.addEventListener(event, (e) => callbacks[callback]?.(e.detail));
      }
      const apply = (values) => {
        for (const [name, value] of Object.entries(values)) {
          if (name in EVENTS) callbacks[name] = value;
          else if (typeof value === 'string' && name === 'source')
            element.setAttribute('src', value);
          else element[name] = value;
        }
      };
      apply(props);
      host.append(element);
      return {
        get root() {
          return element.shadowRoot.querySelector('[data-fovea-root]');
        },
        update: apply,
        destroy() {
          element.remove();
        },
      };
    },
  };
}

/** A React component that wraps the controller, as each viewer's React component will. */
export function reactAdapter(create) {
  function Wrapper(props) {
    const hostRef = useRef(null);
    const viewer = useRef(null);
    useEffect(() => {
      viewer.current = create(hostRef.current, props);
      return () => viewer.current.destroy();
      // Created once; later props go through `update` below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => viewer.current?.update(props));
    return <div ref={hostRef} style={{ height: '100%' }} />;
  }
  return {
    name: 'react wrapper',
    acceptsShadowRoot: false,
    mount(props, { host }) {
      // React clears the container it renders into, so give it a container of its own.
      const container = document.createElement('div');
      host.append(container);
      const root = createRoot(container);
      let current = props;
      let destroyed = false;
      const render = () =>
        act(() =>
          root.render(
            <StrictMode>
              <Wrapper {...current} />
            </StrictMode>,
          ),
        );
      render();
      return {
        get root() {
          return container.querySelector('[data-fovea-root]');
        },
        update(next) {
          if (destroyed) return;
          current = { ...current, ...next };
          render();
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          act(() => root.unmount());
          container.remove();
        },
      };
    },
  };
}

/** A viewer's real React component, as users render it. */
export function reactComponentAdapter(Component) {
  return {
    name: 'react component',
    acceptsShadowRoot: false,
    mount(props, { host }) {
      // React clears the container it renders into, so give it a container of its own.
      const container = document.createElement('div');
      host.append(container);
      const root = createRoot(container);
      let current = props;
      let destroyed = false;
      const render = () =>
        act(() =>
          root.render(
            <StrictMode>
              <Component {...current} />
            </StrictMode>,
          ),
        );
      render();
      return {
        get root() {
          return container.querySelector('[data-fovea-root]');
        },
        update(next) {
          if (destroyed) return;
          current = { ...current, ...next };
          render();
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          act(() => root.unmount());
          container.remove();
        },
      };
    },
  };
}
