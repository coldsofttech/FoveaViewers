import { describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { CodeViewer } from './CodeViewer.jsx';
import { defineCodeElement } from './element.js';
import { createCodeViewer } from './vanilla/index.js';

describeConformance('code', {
  text: 'const a = 1;\nconsole.log(a);',
  // The code viewer opens in the Light+ colours when it is given none.
  themeClears: false,
  shows: (root) => {
    expect(root.querySelector('[data-line="1"]')).toHaveTextContent('const a = 1;');
    expect(root.querySelector('[data-line="2"]')).toHaveTextContent('console.log(a);');
  },
  adapters: [
    vanillaAdapter(createCodeViewer),
    elementAdapter('fovea-code', defineCodeElement),
    reactComponentAdapter(CodeViewer),
  ],
});

describe('createCodeViewer', () => {
  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createCodeViewer(host, props) };
  };
  const named = (text, name) => new File([text], name);

  it('works out the language from the file name, colours the lines and labels the viewer', async () => {
    const onReady = vi.fn();
    const { host, viewer } = open({ source: named('const a = 1;', 'a.js'), onReady });
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady.mock.calls[0][0]).toMatchObject({
      lineCount: 1,
      language: 'js',
      mode: 'source',
    });
    expect(viewer.element.querySelector('[role="region"]')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('source'),
    );
    expect(viewer.element.querySelector('[data-line="1"] span span').style.color).toContain(
      '--fovea-token-',
    );
    viewer.destroy();
    host.remove();
  });

  it('lays out a minified file, and shows the source when asked', async () => {
    const minified = JSON.stringify({ a: 1, b: [1, 2, 3], c: 'x'.repeat(2100) });
    const { host, viewer } = open({ source: named(minified, 'a.json') });
    await vi.waitFor(() =>
      expect(viewer.element.querySelectorAll('[data-line]').length).toBeGreaterThan(3),
    );
    viewer.update({ mode: 'source' });
    await vi.waitFor(() => expect(viewer.element.querySelectorAll('[data-line]')).toHaveLength(1));
    viewer.destroy();
    host.remove();
  });

  it('finds a match, marks it, and reports where once for each place', async () => {
    const onLocated = vi.fn();
    const { host, viewer } = open({
      source: named('one\ntwo words here\nthree', 'a.txt'),
      match: { matched: 'words' },
      onLocated,
    });
    await vi.waitFor(() => expect(onLocated).toHaveBeenCalledTimes(1));
    expect(onLocated.mock.calls[0][0]).toMatchObject({ line: 2 });
    await vi.waitFor(() => expect(viewer.element.querySelector('mark')).toHaveTextContent('words'));
    viewer.update({ label: 'Notes' });
    expect(onLocated).toHaveBeenCalledTimes(1);
    viewer.update({ match: { matched: 'nowhere' } });
    expect(onLocated).toHaveBeenLastCalledWith(null);
    viewer.destroy();
    host.remove();
  });

  it('starts the text viewer again for a new language, back at the top', async () => {
    const { host, viewer } = open({ source: named('a: 1', 'a.txt'), language: 'yaml' });
    await vi.waitFor(() => expect(viewer.element.querySelector('[data-line]')).not.toBeNull());
    const first = viewer.element.querySelector('[data-fovea-root] [data-fovea-root]');
    viewer.update({ language: 'json' });
    expect(viewer.element.querySelector('[data-fovea-root] [data-fovea-root]')).not.toBe(first);
    expect(first.isConnected).toBe(false);
    viewer.destroy();
    host.remove();
  });

  it('reports a file that cannot be loaded once', async () => {
    const onError = vi.fn();
    const { host, viewer } = open({
      source: '/gone',
      fetcher: async () => new Response('', { status: 404 }),
      onError,
    });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('404');
    viewer.destroy();
    host.remove();
  });
});
