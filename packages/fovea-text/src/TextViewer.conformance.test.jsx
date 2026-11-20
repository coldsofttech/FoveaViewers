import { describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { TextViewer } from './TextViewer.jsx';
import { defineTextElement } from './element.js';
import { createTextViewer } from './vanilla/index.js';

// What every viewer must do, through each way of using this one.
describeConformance('text', {
  text: 'first line\nsecond line',
  shows: (root) => {
    expect(root.querySelector('[data-line="1"]')).toHaveTextContent('first line');
    expect(root.querySelector('[data-line="2"]')).toHaveTextContent('second line');
  },
  adapters: [
    vanillaAdapter(createTextViewer),
    elementAdapter('fovea-text', defineTextElement),
    reactComponentAdapter(TextViewer),
  ],
});

describe('<fovea-text>', () => {
  const connect = (setup) => {
    const el = document.createElement('fovea-text');
    setup(el);
    document.body.append(el);
    return el;
  };

  it('is registered by importing the element, under the tag it documents', () => {
    expect(customElements.get('fovea-text')).toBeDefined();
    expect(defineTextElement()).toBe(customElements.get('fovea-text'));
  });

  it('reads src, label and line-height from attributes', async () => {
    const fetcher = vi.fn(async () => new Response('a\nb'));
    const el = connect((e) => {
      e.setAttribute('src', '/x.txt');
      e.setAttribute('label', 'Notes');
      e.setAttribute('line-height', '30');
      e.fetcher = fetcher;
    });
    const root = () => el.shadowRoot.querySelector('[data-fovea-root]');
    await vi.waitFor(() => expect(root().querySelector('[data-line="2"]')).not.toBeNull());
    expect(root().getAttribute('aria-label')).toBe('Notes');
    expect(root().querySelector('[data-line="1"]').style.height).toBe('30px');
    el.remove();
  });

  it('dispatches fovea-ready with the line count and fovea-error with the error', async () => {
    const ready = vi.fn();
    const failed = vi.fn();
    const el = connect((e) => {
      e.addEventListener('fovea-ready', (event) => ready(event.detail));
      e.addEventListener('fovea-error', (event) => failed(event.detail));
      e.source = new Blob(['a\nb\nc']);
    });
    await vi.waitFor(() => expect(ready).toHaveBeenCalledWith({ lineCount: 3 }));
    el.source = '/gone';
    el.fetcher = async () => new Response('', { status: 404 });
    await vi.waitFor(() => expect(failed).toHaveBeenCalled());
    expect(failed.mock.calls[0][0]).toBeInstanceOf(Error);
    el.remove();
  });
});
