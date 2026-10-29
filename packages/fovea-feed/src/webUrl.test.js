import { describe, expect, it } from 'vitest';
import { webUrl } from './webUrl.js';

describe('webUrl', () => {
  it('keeps an http or https address in its full form', () => {
    expect(webUrl(' https://blog.example.com/logo.png ')).toBe('https://blog.example.com/logo.png');
    expect(webUrl('http://example.com')).toBe('http://example.com/');
    expect(webUrl('https://example.com/a?b=1&c=2#x')).toBe('https://example.com/a?b=1&c=2#x');
  });

  it('turns away anything that is not clearly a web address', () => {
    expect(webUrl('javascript:alert(1)')).toBe('');
    expect(webUrl('data:image/png;base64,AAAA')).toBe('');
    expect(webUrl('//example.com/logo.png')).toBe('');
    expect(webUrl('/logo.png')).toBe('');
    expect(webUrl('https://example.com/a b.png')).toBe('');
    expect(webUrl('https://example.com/"onerror="x')).toBe('');
    expect(webUrl('https://example.com/<b>')).toBe('');
    expect(webUrl('')).toBe('');
    expect(webUrl(undefined)).toBe('');
  });
});
