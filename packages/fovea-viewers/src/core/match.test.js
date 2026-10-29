import { describe, expect, it } from 'vitest';
import { bestMatch, isIgnored, scoreMatch, squash } from './match.js';

describe('squash', () => {
  it('drops spaces and markup characters and lowers the case', () => {
    expect(squash('A **Bold** _word_')).toBe('aboldword');
    expect(squash(undefined)).toBe('');
  });
});

describe('isIgnored', () => {
  it('tells markup and spaces from letters', () => {
    expect(isIgnored('*')).toBe(true);
    expect(isIgnored(' ')).toBe(true);
    expect(isIgnored('a')).toBe(false);
  });
});

describe('bestMatch', () => {
  it('finds the occurrence whose surroundings match', () => {
    const hay = 'applesandfishorangesandfish';
    expect(bestMatch(hay, 'fish', 'orangesand', '')).toBe(hay.lastIndexOf('fish'));
    expect(bestMatch(hay, 'fish', 'applesand', '')).toBe(hay.indexOf('fish'));
  });

  it('is -1 when the words are not there', () => {
    expect(bestMatch('abc', 'zzz', '', '')).toBe(-1);
  });
});

describe('scoreMatch', () => {
  it('scores how well the surroundings agree, so texts can be compared', () => {
    const near = scoreMatch('applesandfish', 'fish', 'applesand', '');
    const far = scoreMatch('pearsandfish', 'fish', 'applesand', '');
    expect(near.at).toBe(9);
    expect(near.score).toBeGreaterThan(far.score);
    expect(scoreMatch('abc', 'zzz', '', '')).toEqual({ at: -1, score: -1 });
  });
});
