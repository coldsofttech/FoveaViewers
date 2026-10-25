import { describe, expect, it } from 'vitest';
import { locateInSource } from './locate.js';

describe('locateInSource', () => {
  it('finds words through the markup', () => {
    const text = '# Title\n\nSome **bold text** here.\n';
    const found = locateInSource(text, { matched: 'bold text' });
    expect(found?.line).toBe(3);
    expect(text.slice(found?.offset, found?.end)).toBe('bold text');
  });

  it('chooses the occurrence whose surroundings match', () => {
    const text = 'apples and fish\n\noranges and fish\n';
    const found = locateInSource(text, { before: 'oranges and', matched: 'fish' });
    expect(found?.line).toBe(3);
  });

  it('gives the column, and says nothing when the words are not there', () => {
    expect(locateInSource('one two three', { matched: 'two' })?.column).toBe(5);
    expect(locateInSource('one two three', { matched: 'four' })).toBeNull();
    expect(locateInSource('one', { matched: '   ' })).toBeNull();
  });
});
