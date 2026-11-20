// The installed packages used without React: plain functions and Web Components.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTextViewer } from '@coldsofttech/fovea-text/vanilla';
import { createImageViewer } from '@coldsofttech/fovea-image/vanilla';
import '@coldsofttech/fovea-text/element';
import '@coldsofttech/fovea-image/element';

const hosts = [];
const add = (element) => {
  document.body.append(element);
  hosts.push(element);
  return element;
};
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

describe('the installed packages without React', () => {
  it('createTextViewer shows a file and cleans up', async () => {
    const onReady = vi.fn();
    const viewer = createTextViewer(add(document.createElement('div')), {
      source: new Blob(['one\ntwo\nthree']),
      onReady,
    });
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith({ lineCount: 3 }));
    expect(viewer.element.querySelectorAll('[data-line]')).toHaveLength(3);
    viewer.destroy();
    expect(viewer.element.isConnected).toBe(false);
  });

  it('<fovea-text> is defined by importing /element, and carries its own CSS', async () => {
    const element = add(document.createElement('fovea-text'));
    element.source = new Blob(['hello']);
    await vi.waitFor(() =>
      expect(element.shadowRoot.querySelector('[data-line="1"]')?.textContent).toContain('hello'),
    );
    // jsdom has no constructable stylesheets, so the CSS is in a <style> element.
    const css = element.shadowRoot.querySelector('style').textContent;
    expect(css).toContain(':host');
    expect(css).toMatch(/overflow/);
  });

  it('createImageViewer and <fovea-image> show a picture', () => {
    const viewer = createImageViewer(add(document.createElement('div')), { source: '/a.png' });
    expect(viewer.element.querySelector('img').getAttribute('src')).toBe('/a.png');
    const element = add(document.createElement('fovea-image'));
    element.setAttribute('src', '/b.png');
    expect(element.shadowRoot.querySelector('img').getAttribute('src')).toBe('/b.png');
  });
});

describe('every viewer that can be used without React', () => {
  const IDS = ['code', 'email', 'feed', 'html', 'image', 'markdown', 'table', 'text'];

  it.each(IDS)('the %s viewer exports its function and registers its element', async (id) => {
    const module = await import(/* @vite-ignore */ `@coldsofttech/fovea-${id}/vanilla`);
    const name = `create${id[0].toUpperCase()}${id.slice(1)}Viewer`;
    expect(typeof module[name]).toBe('function');
    expect(module.meta.id).toBe(id);
    await import(/* @vite-ignore */ `@coldsofttech/fovea-${id}/element`);
    expect(customElements.get(`fovea-${id}`)).toBeDefined();
    const css = (
      await import(/* @vite-ignore */ `@coldsofttech/fovea-${id === 'code' ? 'text' : id}/css`)
    ).default;
    expect(css).toMatch(/\{/);
  });
});

describe('createViewer and <fovea-viewer> from the installed package', () => {
  it('open a file in the viewer for it, loading that viewer when needed', async () => {
    const { createViewer } = await import('@coldsofttech/fovea-viewers/vanilla');
    const host = add(document.createElement('div'));
    const viewer = createViewer(host, { source: new File(['# Hello'], 'a.md') });
    await vi.waitFor(() => expect(host.querySelector('h1')?.textContent).toBe('Hello'));
    viewer.destroy();

    await import('@coldsofttech/fovea-viewers/element');
    const element = add(document.createElement('fovea-viewer'));
    element.source = new File(['a,b\n1,2'], 'a.csv');
    await vi.waitFor(() =>
      expect(element.shadowRoot.querySelector('tbody td')?.textContent).toBe('1'),
    );
  });
});
