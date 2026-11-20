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
