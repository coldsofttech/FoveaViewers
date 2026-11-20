import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLineViewer } from './createLineViewer.js';
import { createTextViewer } from './createTextViewer.js';

const hosts = [];
const host = () => {
  const el = document.createElement('div');
  document.body.append(el);
  hosts.push(el);
  return el;
};
afterEach(() => {
  for (const el of hosts.splice(0)) el.remove();
});

const many = (n) => Array.from({ length: n }, (_, i) => `line ${i + 1}`);
const numbers = (container) =>
  [...container.querySelectorAll('[data-line]')].map((el) => Number(el.dataset.line));

describe('createLineViewer', () => {
  it('draws only the lines near the view, in order', () => {
    const container = host();
    createLineViewer(container, { lines: many(10_000) });
    const drawn = numbers(container);
    expect(drawn.length).toBeLessThan(80);
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
    expect(drawn[0]).toBe(1);
    expect(container.querySelector('[data-fovea-root] > div').style.height).toBe('200000px');
  });

  it('draws the lines scrolled to, keeps the DOM in order and reuses the lines still in view', () => {
    const container = host();
    const viewer = createLineViewer(container, { lines: many(10_000) });
    const root = viewer.element;
    Object.defineProperty(root, 'clientHeight', { value: 400, configurable: true });
    const kept = root.querySelector('[data-line="30"]');

    root.scrollTop = 2000; // line 100
    root.dispatchEvent(new Event('scroll'));
    let drawn = numbers(container);
    // Lines 80 to 140 (indexes), plus the 20 either side kept for smooth scrolling.
    expect(drawn[0]).toBe(81);
    expect(drawn.at(-1)).toBe(141);
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
    expect(root.querySelector('[data-line="30"]')).toBeNull();

    root.scrollTop = 1900; // a little back up: lines above are added in front, in order
    root.dispatchEvent(new Event('scroll'));
    drawn = numbers(container);
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
    expect(new Set(drawn).size).toBe(drawn.length);
    expect(kept.isConnected).toBe(false);
  });

  it('scrolls the target line to the middle once, marks its characters and scrolls again for a new target', () => {
    const container = host();
    const viewer = createLineViewer(container, { lines: many(1000), lineHeight: 20 });
    const root = viewer.element;
    Object.defineProperty(root, 'clientHeight', { value: 400, configurable: true });
    viewer.update({ target: { line: 500, column: 6, length: 3 } });
    root.dispatchEvent(new Event('scroll')); // the browser has measured the view
    expect(root.scrollTop).toBe(499 * 20 - (400 - 20) / 2);
    const mark = root.querySelector('mark');
    expect(mark).toHaveTextContent('500'.slice(0, 3));
    expect(root.querySelector('[data-line="500"]').className).toContain('current');

    root.scrollTop = 0;
    viewer.update({ lineHeight: 20 }); // nothing changed: no new scroll
    expect(root.scrollTop).toBe(0);
    viewer.update({ target: { line: 10 } });
    expect(root.scrollTop).toBe(Math.max(0, 9 * 20 - (400 - 20) / 2));
  });

  it('colours lines through the tokens function, and again when it changes', () => {
    const container = host();
    const viewer = createLineViewer(container, {
      lines: ['const a'],
      tokens: () => [
        ['keyword', 'const'],
        [null, ' a'],
      ],
    });
    expect(container.querySelector('span span').style.color).toContain('keyword');
    viewer.update({ tokens: () => [['string', 'const a']] });
    expect(container.querySelector('span span').style.color).toContain('string');
  });

  it('shows loading and error messages and reports the lines and the error once each', () => {
    const container = host();
    const onReady = vi.fn();
    const onError = vi.fn();
    const viewer = createLineViewer(container, {
      lines: null,
      status: 'loading',
      onReady,
      onError,
    });
    expect(viewer.element.querySelector('[role="status"]')).toHaveTextContent('Loading');
    expect(viewer.element.getAttribute('aria-busy')).toBe('true');
    const lines = ['a', 'b'];
    viewer.update({ lines, status: 'ready' });
    viewer.update({ lines, label: 'Other' });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith({ lineCount: 2 });
    const error = new Error('gone');
    viewer.update({ lines: null, status: 'error', error });
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('gone');
    viewer.update({ label: 'Again' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(viewer.element.querySelector('[data-line]')).toBeNull();
  });

  it('works without any props', () => {
    const viewer = createLineViewer(host(), {});
    expect(viewer.element.getAttribute('aria-label')).toBe('Text');
    viewer.destroy();
  });
});

describe('createTextViewer', () => {
  it('shows the loading message, then the lines, and starts again for a new source', async () => {
    const container = host();
    const viewer = createTextViewer(container, { source: new Blob(['one\ntwo\n']) });
    expect(viewer.element.querySelector('[role="status"]')).not.toBeNull();
    await vi.waitFor(() => expect(numbers(container)).toEqual([1, 2]));
    expect(viewer.element.querySelector('[role="status"]')).toBeNull();

    viewer.update({ source: new Blob(['x']) });
    expect(viewer.element.querySelector('[role="status"]')).not.toBeNull();
    await vi.waitFor(() => expect(numbers(container)).toEqual([1]));
  });

  it('throws a TypeError without a source', () => {
    expect(() => createTextViewer(host(), {})).toThrow(TypeError);
  });
});
