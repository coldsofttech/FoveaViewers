import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineViewerElement } from './index.js';

let counter = 0;
const nextTag = () => `fovea-t${++counter}`;

/** A viewer that records what it is given, so the element's own behaviour can be checked. */
function recorder() {
  const calls = { created: [], updates: [], destroyed: 0, shadows: [] };
  const create = vi.fn((container, props) => {
    calls.created.push(props);
    calls.shadows.push(container);
    const element = container.ownerDocument.createElement('div');
    element.setAttribute('data-fovea-root', '');
    container.append(element);
    return {
      element,
      update: (next) => calls.updates.push(next),
      destroy: () => {
        calls.destroyed++;
        element.remove();
      },
    };
  });
  return { create, calls };
}

const mounted = [];
const add = (el) => {
  document.body.append(el);
  mounted.push(el);
  return el;
};
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

describe('defineViewerElement', () => {
  it('registers once, returns the class and leaves an existing tag alone', () => {
    const tag = nextTag();
    const define = defineViewerElement({ tag, create: recorder().create });
    const first = define();
    expect(customElements.get(tag)).toBe(first);
    expect(define()).toBe(first);
    const renamed = define(nextTag());
    expect(renamed).not.toBe(first);
  });

  it('does nothing and returns null where there are no custom elements', () => {
    const define = defineViewerElement({ tag: nextTag(), create: recorder().create });
    vi.stubGlobal('customElements', undefined);
    expect(define()).toBeNull();
    vi.unstubAllGlobals();
    vi.stubGlobal('HTMLElement', undefined);
    expect(define()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('waits for the required props, then creates the viewer in an open shadow root', () => {
    const { create, calls } = recorder();
    const tag = nextTag();
    defineViewerElement({ tag, create, attributes: { src: 'source' } })();
    const el = add(document.createElement(tag));
    expect(el.shadowRoot).not.toBeNull();
    expect(create).not.toHaveBeenCalled();
    el.source = 'file.txt';
    expect(create).toHaveBeenCalledTimes(1);
    expect(calls.shadows[0]).toBe(el.shadowRoot);
    expect(calls.created[0].source).toBe('file.txt');
  });

  it('does not create a viewer until it is connected', () => {
    const { create } = recorder();
    const tag = nextTag();
    defineViewerElement({ tag, create, attributes: { src: 'source' } })();
    const el = document.createElement(tag);
    el.setAttribute('src', 'a');
    expect(create).not.toHaveBeenCalled();
    add(el);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('maps attributes to props with their types', () => {
    const { create, calls } = recorder();
    const tag = nextTag();
    defineViewerElement({
      tag,
      create,
      attributes: {
        src: 'source',
        label: 'label',
        'page-size': ['pageSize', 'number'],
        'allow-images': ['allowImages', 'boolean'],
      },
    })();
    const el = document.createElement(tag);
    el.setAttribute('src', 'a');
    el.setAttribute('page-size', '25');
    el.setAttribute('allow-images', '');
    add(el);
    expect(calls.created[0]).toMatchObject({ source: 'a', pageSize: 25, allowImages: true });
    expect(el.pageSize).toBe(25);

    el.setAttribute('label', 'Doc');
    expect(calls.updates.at(-1)).toEqual({ label: 'Doc' });
    el.setAttribute('allow-images', 'false');
    expect(calls.updates.at(-1)).toEqual({ allowImages: false });
    el.removeAttribute('allow-images');
    expect(calls.updates.at(-1)).toEqual({ allowImages: undefined });
    el.removeAttribute('page-size');
    expect(calls.updates.at(-1)).toEqual({ pageSize: undefined });
  });

  it('exposes props as properties and applies changes to the live viewer', () => {
    const { create, calls } = recorder();
    const tag = nextTag();
    defineViewerElement({ tag, create, attributes: { src: 'source' }, properties: ['fetcher'] })();
    const el = document.createElement(tag);
    const fetcher = () => {};
    el.fetcher = fetcher;
    el.source = new Blob(['x']);
    expect(el.fetcher).toBe(fetcher);
    add(el);
    expect(calls.created[0].fetcher).toBe(fetcher);
    el.source = 'next';
    expect(calls.updates.at(-1)).toEqual({ source: 'next' });
  });

  it('destroys the viewer on disconnect and creates a new one with the same props on reconnect', () => {
    const { create, calls } = recorder();
    const tag = nextTag();
    defineViewerElement({ tag, create, attributes: { src: 'source' } })();
    const el = document.createElement(tag);
    el.setAttribute('src', 'a');
    add(el);
    el.remove();
    expect(calls.destroyed).toBe(1);
    add(el);
    expect(create).toHaveBeenCalledTimes(2);
    expect(calls.created[1].source).toBe('a');
    el.remove();
    el.source = 'b'; // set while disconnected: kept for the next connect
    add(el);
    expect(calls.created[2].source).toBe('b');
  });

  it('turns callbacks into bubbling, composed events', () => {
    const { create, calls } = recorder();
    const tag = nextTag();
    defineViewerElement({
      tag,
      create,
      attributes: { src: 'source' },
      events: { onReady: 'fovea-ready', onError: { name: 'fovea-error' } },
    })();
    const el = document.createElement(tag);
    el.source = 'a';
    add(el);
    const seen = [];
    document.body.addEventListener('fovea-ready', (e) => seen.push(e));
    calls.created[0].onReady({ pageCount: 3 });
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ pageCount: 3 });
    expect(seen[0].composed).toBe(true);
    expect(seen[0].cancelable).toBe(false);
    const error = new Error('x');
    let heard;
    el.addEventListener('fovea-error', (e) => (heard = e.detail));
    calls.created[0].onError(error);
    expect(heard).toBe(error);
  });

  it('runs the fallback of a cancelable event unless it is prevented', () => {
    const { create, calls } = recorder();
    const tag = nextTag();
    const fallback = vi.fn();
    defineViewerElement({
      tag,
      create,
      attributes: { src: 'source' },
      events: {
        onNavigate: {
          name: 'fovea-navigate',
          cancelable: true,
          detail: (href, event) => ({ href, event }),
          fallback,
        },
      },
    })();
    const el = document.createElement(tag);
    el.source = 'a';
    add(el);
    const click = new Event('click');
    let prevent = false;
    el.addEventListener('fovea-navigate', (e) => {
      expect(e.detail).toEqual({ href: '/x', event: click });
      if (prevent) e.preventDefault();
    });
    calls.created[0].onNavigate('/x', click);
    expect(fallback).toHaveBeenCalledWith(el, '/x', click);
    prevent = true;
    calls.created[0].onNavigate('/x', click);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('falls back to a <style> element when constructable stylesheets are missing', () => {
    const { create } = recorder();
    const tag = nextTag();
    defineViewerElement({ tag, create, css: '.x{color:red}', attributes: { src: 'source' } })();
    const el = add(document.createElement(tag));
    // jsdom has no adoptedStyleSheets, which is exactly the case this covers.
    const style = el.shadowRoot.querySelector('style');
    expect(style.textContent).toContain(':host{display:block;height:100%}');
    expect(style.textContent).toContain('.x{color:red}');
  });

  it('adopts one shared stylesheet when the browser supports it', () => {
    const replaceSync = vi.fn();
    class FakeSheet {
      cssRules = [];
      replaceSync = (text) => {
        replaceSync(text);
        this.cssRules = [1];
      };
    }
    vi.stubGlobal('CSSStyleSheet', FakeSheet);
    const original = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets');
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      configurable: true,
      get() {
        return this._sheets ?? [];
      },
      set(value) {
        this._sheets = value;
      },
    });
    try {
      const { create } = recorder();
      const tag = nextTag();
      defineViewerElement({ tag, create, css: '.y{}', attributes: { src: 'source' } })();
      const a = add(document.createElement(tag));
      const b = add(document.createElement(tag));
      expect(a.shadowRoot.adoptedStyleSheets).toHaveLength(1);
      expect(a.shadowRoot.adoptedStyleSheets[0]).toBe(b.shadowRoot.adoptedStyleSheets[0]);
      expect(replaceSync).toHaveBeenCalledTimes(1);
      expect(replaceSync.mock.calls[0][0]).toContain('.y{}');
      expect(a.shadowRoot.querySelector('style')).toBeNull();
    } finally {
      if (original) Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', original);
      else delete ShadowRoot.prototype.adoptedStyleSheets;
      vi.unstubAllGlobals();
    }
  });

  it('keeps theme tokens set on the host out of the viewer element but available to it', () => {
    const { create } = recorder();
    const tag = nextTag();
    defineViewerElement({ tag, create, attributes: { src: 'source' } })();
    const el = document.createElement(tag);
    el.style.setProperty('--fovea-background', '#010203');
    el.source = 'a';
    add(el);
    expect(el.style.getPropertyValue('--fovea-background')).toBe('#010203');
  });
});
