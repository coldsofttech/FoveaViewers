import { describe, expect, it } from 'vitest';
import { clearMarks, markIn } from './mark.js';

const block = (html) => {
  const element = document.createElement('div');
  element.innerHTML = html; // eslint-disable-line no-unsanitized/property -- fixed test markup
  return element;
};

describe('markIn', () => {
  it('marks words across the formatting that splits them, and clears again', () => {
    const root = block('<p>Some <strong>bold</strong> text here</p>');
    const mark = markIn(root, { matched: 'bold text' });
    expect(mark).not.toBeNull();
    expect([...root.querySelectorAll('mark')].map((m) => m.textContent).join('')).toBe('bold text');
    clearMarks(root);
    expect(root.querySelector('mark')).toBeNull();
    expect(root.textContent).toBe('Some bold text here');
  });

  it('takes the occurrence whose surroundings match', () => {
    const root = block('<p>apples and fish, oranges and fish</p>');
    markIn(root, { before: 'oranges and', matched: 'fish' });
    const mark = root.querySelector('mark');
    expect(mark?.previousSibling?.textContent).toContain('oranges and ');
  });

  it('is null when the words are not in what is shown', () => {
    const root = block('<p>nothing to see</p>');
    expect(markIn(root, { matched: 'absent' })).toBeNull();
    expect(root.querySelector('mark')).toBeNull();
  });
});
