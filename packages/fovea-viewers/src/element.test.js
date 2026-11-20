import { afterEach, describe, expect, it, vi } from 'vitest';
import './element.js';

const mounted = [];
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  vi.restoreAllMocks();
});
const open = (setup) => {
  const el = document.createElement('fovea-viewer');
  setup(el);
  document.body.append(el);
  mounted.push(el);
  return el;
};
const file = (text, name) => new File([text], name);
const inner = (el) => el.shadowRoot.querySelector('[data-fovea-root] [data-fovea-root]');

describe('<fovea-viewer>', () => {
  it('is registered by importing /element and opens a file in the viewer for it', async () => {
    expect(customElements.get('fovea-viewer')).toBeDefined();
    const ready = vi.fn();
    const el = open((e) => {
      e.addEventListener('fovea-ready', (event) => ready(event.detail));
      e.source = file('# Hello', 'a.md');
    });
    await vi.waitFor(() => expect(inner(el).querySelector('h1')).toHaveTextContent('Hello'));
    expect(ready).toHaveBeenCalledWith({ blockCount: 1 });
  });

  it("takes type and theme as attributes and the viewer's own props in options", async () => {
    const el = open((e) => {
      e.setAttribute('type', 'table');
      e.setAttribute('theme', 'dark');
      e.options = { header: false };
      e.source = new Blob(['a,b']);
    });
    await vi.waitFor(() => expect(inner(el).querySelector('th')).toHaveTextContent('Column 1'));
    el.options = { header: true };
    await vi.waitFor(() => expect(inner(el).querySelector('th')).toHaveTextContent('a'));
  });

  it('reports a file it cannot place in fovea-error', async () => {
    const failed = vi.fn();
    open((e) => {
      e.addEventListener('fovea-error', (event) => failed(event.detail.message));
      e.source = file('x', 'mystery.zzz');
    });
    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledWith(expect.stringContaining('Pass a "type"')),
    );
  });

  it('opens a link from the viewer in a new window unless fovea-navigate is cancelled', async () => {
    const win = vi.spyOn(window, 'open').mockReturnValue(null);
    const el = open((e) => {
      e.source = file('[page](https://example.test/a)', 'a.md');
    });
    const anchor = await vi.waitFor(() => {
      const found = inner(el)?.querySelector('a');
      if (!found) throw new Error('not yet');
      return found;
    });
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(win).toHaveBeenCalledWith('https://example.test/a', '_blank', 'noopener,noreferrer');
    el.addEventListener('fovea-navigate', (e) => e.preventDefault());
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(win).toHaveBeenCalledTimes(1);
  });
});
