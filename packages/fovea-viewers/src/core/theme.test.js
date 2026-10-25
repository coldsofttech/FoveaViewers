import { describe, expect, it } from 'vitest';
import { darkTheme, themeVars } from './theme.js';

describe('themeVars', () => {
  it('returns nothing so the page colours apply when there is no theme', () => {
    expect(themeVars(undefined)).toBeUndefined();
  });

  it('maps a preset to prefixed custom properties', () => {
    const vars = themeVars('dark');
    expect(vars?.['--fovea-background']).toBe(darkTheme.background);
    expect(vars?.['--fovea-gutter-background']).toBe(darkTheme['gutter-background']);
  });

  it('maps custom tokens', () => {
    expect(themeVars({ background: 'red' })).toEqual({ '--fovea-background': 'red' });
  });

  it('ignores an unknown preset name', () => {
    expect(themeVars(/** @type {any} */ ('sepia'))).toBeUndefined();
  });
});
