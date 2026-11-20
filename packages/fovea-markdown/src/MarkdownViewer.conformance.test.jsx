import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { MarkdownViewer } from './MarkdownViewer.jsx';
import { defineMarkdownElement } from './element.js';
import { createMarkdownViewer } from './vanilla/index.js';

describeConformance('markdown', {
  text: '# Title\n\nSome **bold** words.',
  shows: (root) => {
    expect(root.querySelector('h1')).toHaveTextContent('Title');
    expect(root.querySelector('strong')).toHaveTextContent('bold');
  },
  adapters: [
    vanillaAdapter(createMarkdownViewer),
    elementAdapter('fovea-markdown', defineMarkdownElement),
    reactComponentAdapter(MarkdownViewer),
  ],
});

/** A file of `count` paragraphs, one source line each separated by a blank line. */
const longFile = (count) =>
  Array.from({ length: count }, (_, i) => `Paragraph number ${i + 1}.`).join('\n\n');

describe('createMarkdownViewer', () => {
  afterEach(() => vi.unstubAllGlobals());

  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createMarkdownViewer(host, props) };
  };
  const groups = (viewer) => [...viewer.element.querySelectorAll('[data-group]')];

  it('splits a long file into groups and draws all of them where there is no IntersectionObserver', async () => {
    const { host, viewer } = open({ source: new Blob([longFile(100)]) });
    await vi.waitFor(() => expect(groups(viewer)).toHaveLength(3));
    expect(viewer.element.querySelectorAll('p')).toHaveLength(100);
    viewer.destroy();
    host.remove();
  });

  it('draws only the groups near the screen, and keeps a space as tall as a group that is dropped', async () => {
    const callbacks = [];
    const observed = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          callbacks.push(callback);
        }
        observe(element) {
          observed.push(element);
        }
        disconnect() {}
      },
    );
    const { host, viewer } = open({ source: new Blob([longFile(100)]) });
    await vi.waitFor(() => expect(observed).toHaveLength(3));
    // Nothing is near yet.
    expect(viewer.element.querySelectorAll('p')).toHaveLength(0);
    const [first, second] = observed;
    callbacks[0]([{ target: second, isIntersecting: true }]);
    expect(second.querySelectorAll('p')).toHaveLength(40);
    expect(first.querySelectorAll('p')).toHaveLength(0);
    callbacks[0]([{ target: second, isIntersecting: false }]);
    expect(second.querySelectorAll('p')).toHaveLength(0);
    // Dropped, but the space stays (jsdom has no layout, so the guess from the lines is used).
    expect(parseInt(second.style.height, 10)).toBeGreaterThan(0);
    viewer.destroy();
    host.remove();
  });

  it('scrolls to the target line and marks its words, drawing the group first when it is far off', async () => {
    const callbacks = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          callbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const onMarked = vi.fn();
    const { host, viewer } = open({
      source: new Blob([longFile(100)]),
      // Paragraph 81 is on line 161 (a blank line sits between paragraphs).
      target: { line: 161, matched: 'number 81' },
      onMarked,
    });
    await vi.waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(true));
    expect(viewer.element.querySelector('mark')).toHaveTextContent('number 81');
    // Only the group that holds the target is drawn.
    expect(groups(viewer).filter((g) => g.firstChild)).toHaveLength(1);
    viewer.update({ target: undefined });
    expect(onMarked).toHaveBeenLastCalledWith(null);
    viewer.destroy();
    host.remove();
  });

  it('reports that the words were not found', async () => {
    const onMarked = vi.fn();
    const { host, viewer } = open({
      source: new Blob(['# Title\n\nSome words.']),
      target: { line: 3, matched: 'nowhere' },
      onMarked,
    });
    await vi.waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(false));
    viewer.destroy();
    host.remove();
  });

  it('follows a footnote link to its place', async () => {
    const { host, viewer } = open({ source: new Blob(['Note here[^1].\n\n[^1]: The note.\n']) });
    await vi.waitFor(() => expect(viewer.element.querySelector('a[href^="#fn"]')).not.toBeNull());
    const target = viewer.element.querySelector('[id="fn1"]');
    const scrolled = vi.spyOn(target, 'getBoundingClientRect');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    viewer.element.querySelector('a[href^="#fn"]').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(scrolled).toHaveBeenCalled();
    viewer.destroy();
    host.remove();
  });

  it('hands other links to onNavigate when given, and leaves them to open otherwise', async () => {
    const onNavigate = vi.fn();
    const { host, viewer } = open({ source: new Blob(['[page](https://example.test/a)']) });
    await vi.waitFor(() => expect(viewer.element.querySelector('a')).not.toBeNull());
    const anchor = viewer.element.querySelector('a');
    expect(anchor).toHaveAttribute('target', '_blank');
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    viewer.update({ onNavigate });
    const handled = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(handled);
    expect(onNavigate).toHaveBeenCalledWith('https://example.test/a', handled);
    expect(handled.defaultPrevented).toBe(true);
    viewer.destroy();
    host.remove();
  });

  it('shows pictures as their alt text unless allowImages, and draws again when that changes', async () => {
    const { host, viewer } = open({ source: new Blob(['![a cat](https://example.test/cat.png)']) });
    await vi.waitFor(() => expect(viewer.element).toHaveTextContent('[a cat]'));
    expect(viewer.element.querySelector('img')).toBeNull();
    viewer.update({ allowImages: true });
    await vi.waitFor(() => expect(viewer.element.querySelector('img')).not.toBeNull());
    viewer.update({ allowImages: false });
    await vi.waitFor(() => expect(viewer.element.querySelector('img')).toBeNull());
    viewer.destroy();
    host.remove();
  });

  it('reports the block count once, and not again for a prop that does not change the text', async () => {
    const onReady = vi.fn();
    const { host, viewer } = open({ source: new Blob(['# a\n\nb']), onReady });
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith({ blockCount: 2 }));
    viewer.update({ label: 'Notes' });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(viewer.element.getAttribute('aria-busy')).toBe('false');
    viewer.destroy();
    host.remove();
  });
});
