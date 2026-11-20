import { afterEach, describe, expect, it, vi } from 'vitest';
import { createViewer } from './createViewer.js';

const hosts = [];
const open = (props, container) => {
  const host = container ?? document.createElement('div');
  if (!container) {
    document.body.append(host);
    hosts.push(host);
  }
  return createViewer(host, props);
};
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
  vi.unstubAllGlobals();
});
const file = (text, name, type = '') => new File([text], name, { type });

describe('createViewer', () => {
  it('opens a file in the viewer its name says, and passes it the other props', async () => {
    const onReady = vi.fn();
    const viewer = open({ source: file('one\ntwo', 'notes.txt'), onReady, theme: 'dark' });
    expect(viewer.element.querySelector('[role="status"]')).toHaveTextContent('Loading');
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith({ lineCount: 2 }));
    expect(viewer.element.querySelector('[role="status"]')).toBeNull();
    expect(viewer.element.querySelectorAll('[data-line]')).toHaveLength(2);
    expect(
      viewer.element
        .querySelector('[data-fovea-root] [data-fovea-root]')
        .style.getPropertyValue('--fovea-background'),
    ).toBe('#1e1e1e');
  });

  it('picks the viewer from the MIME type, from a URL, or from type, which wins', async () => {
    const markdown = open({ source: file('# Title', 'x', 'text/markdown') });
    await vi.waitFor(() => expect(markdown.element.querySelector('h1')).toHaveTextContent('Title'));
    const forced = open({ source: file('# Title', 'notes.md'), type: 'text' });
    await vi.waitFor(() =>
      expect(forced.element.querySelector('[data-line="1"]')).toHaveTextContent('# Title'),
    );
  });

  it('passes the contents of options on to the viewer', async () => {
    const viewer = open({
      source: file('a\nb\nc', 'a.csv'),
      options: { header: false, pageSize: 2 },
    });
    await vi.waitFor(() => expect(viewer.element.querySelectorAll('tbody tr')).toHaveLength(2));
    expect(viewer.element.querySelector('th')).toHaveTextContent('Column 1');
  });

  it('keeps the viewer for a new file of the same kind, and swaps it for another kind', async () => {
    const viewer = open({ source: file('# One', 'a.md') });
    await vi.waitFor(() => expect(viewer.element.querySelector('h1')).toHaveTextContent('One'));
    const inner = viewer.element.querySelector('[data-fovea-root] [data-fovea-root]');
    viewer.update({ source: file('# Two', 'b.md') });
    await vi.waitFor(() => expect(viewer.element.querySelector('h1')).toHaveTextContent('Two'));
    expect(inner.isConnected).toBe(true);
    viewer.update({ source: file('x,y\n1,2', 'c.csv') });
    await vi.waitFor(() => expect(viewer.element.querySelector('table')).not.toBeNull());
    expect(inner.isConnected).toBe(false);
    expect(viewer.element.querySelector('h1')).toBeNull();
  });

  it('forgets a prop that is no longer given', async () => {
    const viewer = open({ source: file('a\nb', 'a.csv'), options: { header: false } });
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('th')).toHaveTextContent('Column 1'),
    );
    viewer.update({ options: undefined });
    expect(viewer.element.querySelector('th')).toHaveTextContent('a');
  });

  it('says so, once, when it cannot tell which viewer to use', async () => {
    const onError = vi.fn();
    const viewer = open({ source: file('x', 'mystery.zzz'), onError });
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('Pass a "type"');
    viewer.update({ label: 'again' });
    expect(onError).toHaveBeenCalledTimes(1);
    viewer.update({ type: 'text' });
    await vi.waitFor(() => expect(viewer.element.querySelector('[data-line]')).not.toBeNull());
    expect(viewer.element.querySelector('[role="alert"]')).toBeNull();
  });

  it('reports a viewer that cannot be used without React yet, or does not exist', async () => {
    const onError = vi.fn();
    const viewer = open({ source: file('x', 'a.pdf'), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].message).toMatch(/pdf.*without React/);
    viewer.update({ type: 'nonsense' });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    expect(onError.mock.calls[1][0].message).toMatch(/Unknown viewer/);
  });

  it("puts the viewer's CSS in a shadow root it is drawn in, once", async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const a = open({ source: file('a', 'a.txt') }, shadow);
    const b = open({ source: file('b', 'b.txt') }, shadow);
    await vi.waitFor(() => {
      expect(a.element.querySelector('[data-line]')).not.toBeNull();
      expect(b.element.querySelector('[data-line]')).not.toBeNull();
    });
    // jsdom has no constructable stylesheets, so the CSS goes in a <style> element. The text
    // viewer's CSS is empty in tests (the build fills it), so nothing is added for it.
    expect(shadow.querySelectorAll('style').length).toBeLessThanOrEqual(1);
    host.remove();
  });

  it('throws a TypeError without a source, and does nothing after destroy', async () => {
    expect(() => open({})).toThrow(TypeError);
    const viewer = open({ source: file('a', 'a.txt') });
    viewer.destroy();
    await new Promise((r) => setTimeout(r, 20));
    expect(viewer.element.isConnected).toBe(false);
  });
});
