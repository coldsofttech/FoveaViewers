import { describe, expect, it } from 'vitest';
import { htmlToText } from './text.js';

describe('htmlToText', () => {
  it('keeps paragraphs and line breaks as lines', () => {
    expect(htmlToText('<p>First</p><p>Second<br>third</p>')).toBe('First\nSecond\nthird');
  });

  it('leaves out scripts, styles and markup, and keeps the words in links and emphasis', () => {
    expect(
      htmlToText(
        '<style>p{color:red}</style><script>alert(1)</script><p>See <a href="https://e.com">the <b>post</b></a></p>',
      ),
    ).toBe('See the post');
  });

  it('never runs or loads anything in the markup', () => {
    expect(htmlToText('<img src="x" onerror="globalThis.ran = true">text')).toBe('text');
    expect(globalThis.ran).toBeUndefined();
  });

  it('returns an empty string for markup with no words', () => {
    expect(htmlToText('<div><br></div>')).toBe('');
  });
});
