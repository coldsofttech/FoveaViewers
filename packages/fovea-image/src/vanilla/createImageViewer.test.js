import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageViewer } from './createImageViewer.js';

const hosts = [];
beforeEach(() => {
  URL.createObjectURL = vi.fn((blob) => `blob:${blob.size}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  for (const el of hosts.splice(0)) el.remove();
  vi.restoreAllMocks();
});

const open = (props) => {
  const host = document.createElement('div');
  document.body.append(host);
  hosts.push(host);
  return createImageViewer(host, props);
};
const load = (root, width = 200, height = 100) => {
  const image = root.querySelector('img');
  Object.defineProperty(image, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: height, configurable: true });
  image.dispatchEvent(new Event('load'));
  return image;
};
const zoom = (root) => root.querySelector('[role="toolbar"] span').textContent;
const press = (root, key, init = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  root.querySelector('[role="region"]').dispatchEvent(event);
  return event;
};

describe('createImageViewer', () => {
  it('releases each temporary address when the image changes and when it is destroyed', async () => {
    const viewer = open({ source: new Blob(['aa']) });
    await vi.waitFor(() => expect(viewer.element.querySelector('img')).not.toBeNull());
    viewer.update({ source: new Blob(['bbbb']) });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2');
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('img')).toHaveAttribute('src', 'blob:4'),
    );
    viewer.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:4');
  });

  it('starts a new image at the fit, forgetting the zoom of the last one', async () => {
    const viewer = open({ source: 'a.png' });
    load(viewer.element);
    press(viewer.element, '+');
    expect(zoom(viewer.element)).toBe('125%');
    viewer.update({ source: 'b.png' });
    expect(viewer.element.querySelector('img')).toHaveAttribute('src', 'b.png');
    expect(zoom(viewer.element)).toBe('');
    load(viewer.element);
    expect(zoom(viewer.element)).toBe('100%');
  });

  it('follows a changed fit until the image has loaded, and not after the reader has zoomed', () => {
    const viewer = open({ source: 'a.png', fit: 'actual' });
    viewer.update({ fit: 'contain' });
    load(viewer.element, 400, 200);
    // jsdom has no layout: the view is 0 × 0, so "contain" and "actual" both give 100%.
    expect(zoom(viewer.element)).toBe('100%');
    press(viewer.element, '+');
    viewer.update({ fit: 'width' });
    expect(zoom(viewer.element)).toBe('125%');
  });

  it('works every key of the keyboard, and leaves other keys and modified keys alone', () => {
    const viewer = open({ source: 'a.png' });
    const image = load(viewer.element);
    const root = viewer.element;
    press(root, '=');
    expect(zoom(root)).toBe('125%');
    press(root, '-');
    press(root, '_');
    expect(zoom(root)).toBe('80%');
    press(root, '0');
    expect(zoom(root)).toBe('100%');
    press(root, '1');
    press(root, ']');
    expect(image.style.transform).toContain('rotate(90deg)');
    press(root, '[');
    expect(image.style.transform).toContain('rotate(0deg)');
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      expect(press(root, key).defaultPrevented).toBe(true);
    }
    expect(press(root, 'x').defaultPrevented).toBe(false);
    expect(press(root, '+', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(zoom(root)).toBe('100%');
  });

  it('ignores the keyboard and the wheel before an image has loaded', () => {
    const viewer = open({ source: 'a.png' });
    expect(press(viewer.element, '+').defaultPrevented).toBe(false);
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true });
    viewer.element.querySelector('[role="region"]').dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('stops the page scrolling when the wheel zooms', () => {
    const viewer = open({ source: 'a.png' });
    load(viewer.element);
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true });
    viewer.element.querySelector('[role="region"]').dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('pans by dragging, with the primary button only, and stops on release', () => {
    const viewer = open({ source: 'a.png' });
    const image = load(viewer.element, 2000, 1000);
    // No layout in jsdom, so the view is 0 × 0 and the image is wider than it: it can be panned.
    const stage = viewer.element.querySelector('[role="region"]');
    const pointer = (type, init) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, button: 0, clientX: 0, clientY: 0, ...init });
      stage.dispatchEvent(event);
    };
    pointer('pointerdown', { button: 2 });
    pointer('pointermove', { clientX: 50 });
    expect(image.style.transform).toContain('translate(0px, 0px)');
    pointer('pointerdown', {});
    pointer('pointermove', { clientX: 30, clientY: 10 });
    expect(image.style.transform).toContain('translate(30px, 10px)');
    pointer('pointermove', { pointerId: 2, clientX: 99 });
    expect(image.style.transform).toContain('translate(30px, 10px)');
    pointer('pointerup', {});
    pointer('pointermove', { clientX: 80 });
    expect(image.style.transform).toContain('translate(30px, 10px)');
    pointer('pointerdown', {});
    pointer('pointercancel', {});
    pointer('pointermove', { clientX: 80 });
    expect(image.style.transform).toContain('translate(30px, 10px)');
  });

  it('gives an SVG with no size of its own the default size', () => {
    const viewer = open({ source: 'a.svg' });
    load(viewer.element, 0, 0);
    expect(viewer.element.querySelector('p')).toHaveTextContent('300 × 150 px');
  });

  it('uses alt, then the label, then "Image" for the picture', () => {
    const viewer = open({ source: 'a.png' });
    expect(viewer.element.querySelector('img')).toHaveAttribute('alt', 'Image');
    viewer.update({ label: 'Photo' });
    expect(viewer.element.querySelector('img')).toHaveAttribute('alt', 'Photo');
    viewer.update({ alt: 'A cat' });
    expect(viewer.element.querySelector('img')).toHaveAttribute('alt', 'A cat');
  });

  it('reports a failed picture and a failed load once each, and shows them', async () => {
    const onError = vi.fn();
    const viewer = open({ source: 'a.png', onError });
    viewer.element.querySelector('img').dispatchEvent(new Event('error'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('could not be shown');
    expect(viewer.element.querySelector('img')).toBeNull();

    viewer.update({ source: '/b.png', fetcher: () => Promise.reject(new Error('offline')) });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('offline');
    expect(viewer.element.getAttribute('aria-busy')).toBe('false');
  });

  it('switching to a URL with no fetcher cancels a load in progress', async () => {
    let finish;
    const fetcher = () => new Promise((resolve) => (finish = () => resolve(new Response('x'))));
    const onReady = vi.fn();
    const viewer = open({ source: '/slow.png', fetcher, onReady });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    viewer.update({ source: '/fast.png', fetcher: undefined });
    finish();
    await new Promise((r) => setTimeout(r, 10));
    expect(viewer.element.querySelector('img')).toHaveAttribute('src', '/fast.png');
  });

  it('keeps the toolbar disabled until an image has loaded', () => {
    const viewer = open({ source: 'a.png' });
    const buttons = [...viewer.element.querySelectorAll('button')];
    expect(buttons).toHaveLength(7);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    load(viewer.element);
    expect(buttons.every((b) => !b.disabled)).toBe(true);
  });

  it('follows the size of the stage', () => {
    let notify;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const viewer = open({ source: 'a.png' });
    load(viewer.element, 400, 200);
    notify([{ contentRect: { width: 200, height: 200 } }]);
    // "contain" fits 400 wide into 200: half size.
    expect(zoom(viewer.element)).toBe('50%');
    vi.unstubAllGlobals();
  });

  it('throws a TypeError without a source', () => {
    expect(() => open({})).toThrow(TypeError);
  });
});
