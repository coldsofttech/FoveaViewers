// The behaviours every viewer must have, whichever entry point it is reached through. A viewer's
// tests call `describeConformance` once with an adapter for each entry point it has (see
// adapters.jsx), so the vanilla controller, the Web Component and the React component cannot drift.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

/** A promise whose outcome the test decides. */
function deferred() {
  /** @type {{ promise?: Promise<any>, resolve?: (v: any) => void, reject?: (e: any) => void }} */
  const d = {};
  d.promise = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return /** @type {{ promise: Promise<any>, resolve: (v: any) => void, reject: (e: any) => void }} */ (
    d
  );
}

/**
 * @param {string} name The viewer's name, for the test titles.
 * @param {object} options
 * @param {Array<{ name: string, acceptsShadowRoot?: boolean, mount: Function }>} options.adapters
 * @param {string | Uint8Array} options.text A small valid file for this viewer: text, or bytes for a
 *   binary format.
 * @param {(root: HTMLElement, text: string) => void} [options.shows] Asserts the file's content is
 *   on screen.
 * @param {Record<string, unknown>} [options.props] Props the viewer needs besides `source`.
 * @param {object} [options.axeOptions] Options for the accessibility check (for example
 *   `{ iframes: false }`, to leave out the page inside a frame).
 * @param {(root: HTMLElement) => string} [options.textOf] The text the viewer is showing, for a
 *   viewer that shows it somewhere `textContent` does not reach (the HTML viewer's frame).
 * @param {boolean} [options.readyOnce] False for a viewer that reports `onReady` again for every
 *   load of the frame it draws in (the HTML viewer), so "once" is "at least once".
 * @param {boolean} [options.hasTheme] False for a viewer with no `theme` prop (the HTML viewer draws
 *   a page on white whatever the theme around it).
 * @param {boolean} [options.themeClears] False for a viewer that has a theme of its own when none is
 *   given (the code viewer), so removing the theme does not remove its colours.
 * @param {(root: HTMLElement) => void} [options.settle] Finishes what jsdom cannot do by itself,
 *   for example firing `load` on an image. Called again and again while a test waits, so it must
 *   do nothing the second time.
 */
export function describeConformance(
  name,
  {
    adapters,
    text,
    shows,
    props = {},
    settle,
    themeClears = true,
    hasTheme = true,
    axeOptions,
    readyOnce = true,
    textOf = (root) => root.textContent,
  },
) {
  // Copied into a Uint8Array of this realm: the encoder's own buffer is not an ArrayBuffer to jsdom.
  // A viewer for a binary format gives its sample as bytes (a Uint8Array) instead of a string.
  const bytes = () =>
    new Uint8Array(typeof text === 'string' ? new TextEncoder().encode(text) : text).buffer;
  // A plain response: the blob of a Node `Response` is not a Blob to jsdom's FileReader, which the
  // viewers for binary formats use.
  const respond = () => ({ ok: true, status: 200, blob: async () => new Blob([text]) });
  /** `onReady` was called (once, unless the viewer reports every load). */
  const reported = (fn) =>
    readyOnce ? expect(fn).toHaveBeenCalledTimes(1) : expect(fn).toHaveBeenCalled();

  for (const adapter of adapters) {
    describe(`${name} conformance: ${adapter.name}`, () => {
      /** @type {HTMLElement} */
      let host;
      /** @type {Array<{ destroy: () => void }>} */
      let mounted;

      beforeEach(() => {
        host = document.createElement('div');
        document.body.append(host);
        mounted = [];
      });
      afterEach(() => {
        for (const handle of mounted) handle.destroy();
        host.remove();
      });

      /** Waits for `check` to pass, settling the viewer between tries. */
      const until = (handle, check) =>
        vi.waitFor(() => {
          if (handle.root) settle?.(handle.root);
          check();
        });

      const mount = (extra, context = {}) => {
        const handle = adapter.mount({ ...props, ...extra }, { host, ...context });
        mounted.push(handle);
        return handle;
      };

      it('loads a Blob and calls onReady once', async () => {
        const onReady = vi.fn();
        const handle = mount({ source: new Blob([text]), onReady });
        await until(handle, () => reported(onReady));
        shows?.(handle.root, text);
      });

      it('loads an ArrayBuffer', async () => {
        const onReady = vi.fn();
        const handle = mount({ source: bytes(), onReady });
        await until(handle, () => reported(onReady));
      });

      it('loads a URL through the host fetcher', async () => {
        const fetcher = vi.fn(async () => respond());
        const onReady = vi.fn();
        const handle = mount({ source: 'https://example.test/file', fetcher, onReady });
        await until(handle, () => reported(onReady));
        expect(fetcher).toHaveBeenCalledWith('https://example.test/file');
      });

      it('reports a failed load through onError, never onReady', async () => {
        const onError = vi.fn();
        const onReady = vi.fn();
        const handle = mount({
          source: '/missing',
          fetcher: async () => new Response('', { status: 404 }),
          onError,
          onReady,
        });
        await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(onReady).not.toHaveBeenCalled();
        expect(handle.root.querySelector('[role="alert"]')).not.toBeNull();
      });

      it('shows the newest source when an older load finishes later', async () => {
        const slow = deferred();
        const fast = deferred();
        const fetcher = vi.fn((url) => (url === '/slow' ? slow.promise : fast.promise));
        const onReady = vi.fn();
        const handle = mount({ source: '/slow', fetcher, onReady });
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        handle.update({ source: '/fast' });
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
        fast.resolve(respond());
        await until(handle, () => reported(onReady));
        const calls = onReady.mock.calls.length;
        slow.resolve(new Response('OLD CONTENT'));
        await new Promise((r) => setTimeout(r, 20));
        settle?.(handle.root);
        if (readyOnce) expect(onReady.mock.calls.length).toBe(calls);
        expect(textOf(handle.root)).not.toContain('OLD CONTENT');
      });

      it('does not reload when props are unchanged or only a callback is replaced', async () => {
        const gate = deferred();
        const fetcher = vi.fn(() => gate.promise);
        const first = vi.fn();
        const second = vi.fn();
        const handle = mount({ source: '/a', fetcher, onReady: first });
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        handle.update({ source: '/a', fetcher });
        handle.update({ onReady: second });
        gate.resolve(respond());
        await until(handle, () => expect(second).toHaveBeenCalled());
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(first).not.toHaveBeenCalled();
      });

      (hasTheme ? it : it.skip)('applies a theme and clears it again', async () => {
        const onReady = vi.fn();
        const handle = mount({ source: new Blob([text]), theme: 'dark', onReady });
        await until(handle, () => expect(onReady).toHaveBeenCalled());
        expect(handle.root.style.getPropertyValue('--fovea-background')).not.toBe('');
        handle.update({ theme: undefined });
        if (themeClears) {
          expect(handle.root.style.getPropertyValue('--fovea-background')).toBe('');
        } else {
          expect(handle.root.style.getPropertyValue('--fovea-background')).not.toBe('');
        }
        handle.update({ theme: { background: '#123456' } });
        expect(handle.root.style.getPropertyValue('--fovea-background')).toBe('#123456');
      });

      it('drops a result that arrives after destroy and removes its DOM', async () => {
        const gate = deferred();
        const onReady = vi.fn();
        const handle = mount({ source: '/late', fetcher: () => gate.promise, onReady });
        handle.destroy();
        gate.resolve(respond());
        await new Promise((r) => setTimeout(r, 20));
        expect(onReady).not.toHaveBeenCalled();
        expect(host.childNodes.length).toBe(0);
      });

      it('survives destroy twice and update after destroy', async () => {
        const handle = mount({ source: new Blob([text]) });
        handle.destroy();
        expect(() => handle.destroy()).not.toThrow();
        expect(() => handle.update({ theme: 'light' })).not.toThrow();
      });

      it('leaves its container siblings alone', async () => {
        const sibling = document.createElement('p');
        sibling.textContent = 'mine';
        host.append(sibling);
        const handle = mount({ source: new Blob([text]) });
        handle.destroy();
        expect(host.contains(sibling)).toBe(true);
        expect(sibling.textContent).toBe('mine');
      });

      it('has no accessibility violations once loaded', async () => {
        const onReady = vi.fn();
        const handle = mount({ source: new Blob([text]), onReady });
        await until(handle, () => expect(onReady).toHaveBeenCalled());
        expect(await axe(host, axeOptions)).toHaveNoViolations();
      });

      if (adapter.acceptsShadowRoot) {
        it('draws inside a shadow root when given one as the container', async () => {
          const shadow = host.attachShadow({ mode: 'open' });
          const onReady = vi.fn();
          const handle = mount({ source: new Blob([text]), onReady }, { container: shadow });
          await until(handle, () => reported(onReady));
          expect(handle.root.getRootNode()).toBe(shadow);
          expect(host.childNodes.length).toBe(0);
          handle.destroy();
          expect(shadow.childNodes.length).toBe(0);
        });
      }
    });
  }
}
