import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme.js';

const value = (el, name) => el.style.getPropertyValue(`--fovea-${name}`);

describe('applyTheme', () => {
  it('sets the tokens of a built-in or custom theme', () => {
    const el = document.createElement('div');
    applyTheme(el, 'dark');
    expect(value(el, 'background')).toBe('#1e1e1e');
    applyTheme(el, { background: '#abcdef' });
    expect(value(el, 'background')).toBe('#abcdef');
  });

  it('removes tokens the new theme no longer sets, and all of them with no theme', () => {
    const el = document.createElement('div');
    applyTheme(el, { background: '#111', link: '#222' });
    applyTheme(el, { background: '#333' });
    expect(value(el, 'link')).toBe('');
    applyTheme(el, undefined);
    expect(value(el, 'background')).toBe('');
  });

  it('leaves properties it did not set alone', () => {
    const el = document.createElement('div');
    el.style.setProperty('--fovea-background', 'red');
    applyTheme(el, undefined);
    expect(value(el, 'background')).toBe('red');
  });
});
