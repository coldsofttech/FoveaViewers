import { describe, expect, it } from 'vitest';
import { anchorsOf, blockAt, blocksOf, createMarkdown, render } from './blocks.js';

const html = (text, options) => {
  const md = createMarkdown(options);
  return blocksOf(md, text)
    .map((b) => render(md, b))
    .join('');
};

describe('blocks', () => {
  it('splits a text into top-level blocks with their source lines', () => {
    const md = createMarkdown();
    const blocks = blocksOf(md, '# Title\n\nSome text.\n\n- one\n- two\n\n```\ncode\n```\n');
    expect(blocks.map((b) => [b.start, b.end])).toEqual([
      [0, 1],
      [2, 3],
      [4, 7],
      [7, 10],
    ]);
  });

  it('finds the block of a line, or the one before it', () => {
    const md = createMarkdown();
    const blocks = blocksOf(md, 'a\n\nb\n\nc\n');
    expect(blockAt(blocks, 0)).toBe(0);
    expect(blockAt(blocks, 1)).toBe(0);
    expect(blockAt(blocks, 2)).toBe(1);
    expect(blockAt(blocks, 4)).toBe(2);
  });
});

describe('rendering', () => {
  it('shows raw HTML as text, never as markup', () => {
    const out = html('<script>alert(1)</script>\n\n<b onclick="x">hi</b>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<b ');
    expect(out).toContain('&lt;script&gt;');
  });

  it('keeps links with a safe address and drops the address of others', () => {
    expect(html('[a](https://example.com/x)')).toContain('<a href="https://example.com/x">a</a>');
    expect(html('[a](mailto:me@example.com)')).toContain('href="mailto:me@example.com"');
    expect(html('[a](#top)')).toContain('href="#top"');
    for (const other of ['ftp://example.com/file', 'tel:123']) {
      expect(html(`[a](${other})`)).toBe('<p><a>a</a></p>\n');
    }
  });

  it('does not make a link of a dangerous address', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
      expect(html(`[a](${bad})`)).not.toContain('<a');
    }
  });

  it('shows pictures as their alt text unless images are allowed', () => {
    expect(html('![a cat](https://example.com/cat.png)')).toContain('[a cat]');
    expect(html('![a cat](https://example.com/cat.png)')).not.toContain('<img');
    expect(html('![a cat](https://example.com/cat.png)', { allowImages: true })).toContain(
      '<img src="https://example.com/cat.png" alt="a cat"',
    );
  });

  it('never loads an image from an unsafe address, even when images are allowed', () => {
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'file:///a.png']) {
      const out = html(`![x](${bad})`, { allowImages: true });
      expect(out).not.toContain('<img');
      expect(out).toContain('[x]');
    }
  });

  it('renders tables, strikethrough, task lists and footnotes', () => {
    expect(html('| a |\n| - |\n| 1 |')).toContain('<table>');
    expect(html('~~gone~~')).toContain('<s>gone</s>');
    const tasks = html('- [x] done\n- [ ] todo');
    expect(tasks).toContain('type="checkbox"');
    expect(tasks).toContain('<label');
    expect(html('text[^1]\n\n[^1]: note')).toContain('footnote');
  });
});

describe('anchorsOf', () => {
  it('maps footnote links and footnotes to the blocks that hold them', () => {
    const md = createMarkdown();
    const blocks = blocksOf(md, 'First[^1] and again[^1].\n\nMiddle.\n\n[^1]: The note.\n');
    const anchors = anchorsOf(blocks);
    expect(anchors.get('fnref1')).toBe(0);
    expect(anchors.get('fnref1:1')).toBe(0);
    expect(anchors.get('fn1')).toBe(blocks.length - 1);
  });
});
