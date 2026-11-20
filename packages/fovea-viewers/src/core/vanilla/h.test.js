import { describe, expect, it, vi } from 'vitest';
import { createH } from './h.js';

const h = createH(document);

describe('h', () => {
  it('builds an element with attributes and children', () => {
    const el = h(
      'a',
      { href: '/x', class: 'link', hidden: true, title: false, id: null },
      'Go ',
      2,
    );
    expect(el.outerHTML).toBe('<a href="/x" class="link" hidden="">Go 2</a>');
  });

  it('never parses markup: strings are text', () => {
    const el = h('p', null, '<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('flattens arrays and nodes and skips empty children', () => {
    const inner = h('b', null, 'b');
    const el = h('p', null, ['a', [inner]], null, undefined, false, 'c');
    expect(el.innerHTML).toBe('a<b>b</b>c');
  });

  it('adds listeners for on* attributes, lowercased', () => {
    const onClick = vi.fn();
    const el = h('button', { onClick }, 'x');
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(el.hasAttribute('onclick')).toBe(false);
  });

  it('creates elements in the document it was made for', () => {
    const other = document.implementation.createHTMLDocument('other');
    expect(createH(other)('p').ownerDocument).toBe(other);
  });
});
