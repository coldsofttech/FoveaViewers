import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { ImageViewer } from './ImageViewer.jsx';
import { defineImageElement } from './element.js';
import { createImageViewer } from './vanilla/index.js';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

/** jsdom does not load images, so the test says when one has loaded and how big it is. */
function settle(root) {
  const image = root.querySelector('img');
  if (!image || image.dataset.settled) return;
  image.dataset.settled = 'yes';
  Object.defineProperty(image, 'naturalWidth', { value: 200, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: 100, configurable: true });
  image.dispatchEvent(new Event('load'));
}

// What every viewer must do, through each way of using this one.
describeConformance('image', {
  text: 'not really a picture, jsdom does not look',
  settle,
  shows: (root) => expect(root.querySelector('img')).toHaveAttribute('src', 'blob:fake'),
  adapters: [
    vanillaAdapter(createImageViewer),
    elementAdapter('fovea-image', defineImageElement),
    reactComponentAdapter(ImageViewer),
  ],
});

describe('<fovea-image>', () => {
  it('turns details off with show-info="false" and on again when the attribute goes', async () => {
    const el = document.createElement('fovea-image');
    el.setAttribute('show-info', 'false');
    el.source = new Blob(['x'.repeat(2048)], { type: 'image/png' });
    document.body.append(el);
    const root = () => el.shadowRoot.querySelector('[data-fovea-root]');
    await vi.waitFor(() => {
      settle(root());
      expect(root().querySelector('[role="toolbar"] button').disabled).toBe(false);
    });
    expect(root().querySelector('p')).toBeNull();
    el.removeAttribute('show-info');
    expect(root().querySelector('p')).toHaveTextContent('200 × 100 px · 2.0 KB · image/png');
    el.remove();
  });

  it('passes fit, alt and label from attributes and reports details in fovea-ready', async () => {
    const ready = vi.fn();
    const el = document.createElement('fovea-image');
    el.addEventListener('fovea-ready', (e) => ready(e.detail));
    el.setAttribute('src', 'https://example.test/a.png');
    el.setAttribute('fit', 'actual');
    el.setAttribute('alt', 'A cat');
    el.setAttribute('label', 'Photo');
    document.body.append(el);
    const root = el.shadowRoot.querySelector('[data-fovea-root]');
    const image = root.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://example.test/a.png');
    expect(image).toHaveAttribute('alt', 'A cat');
    expect(root.querySelector('[role="region"]')).toHaveAttribute('aria-label', 'Photo');
    settle(root);
    expect(ready).toHaveBeenCalledWith({ width: 200, height: 100, size: null, type: null });
    expect(root.querySelector('span').textContent).toBe('100%');
    el.remove();
  });
});
