import { describe, expect, it } from 'vitest';
import { load, resolve } from './registry.js';

describe('resolve', () => {
  it('matches a File by MIME type before extension', () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/markdown' });
    expect(resolve(file)).toBe('markdown');
  });

  it('falls back to the extension when the MIME type is missing', () => {
    expect(resolve(new File(['x'], 'Report.DOCX'))).toBe('word');
  });

  it('reads the extension from a URL and ignores the query string', () => {
    expect(resolve('https://example.com/a/b/slides.pptx?download=1')).toBe('powerpoint');
  });

  it('accepts a bare MIME type with parameters', () => {
    expect(resolve('text/html; charset=utf-8')).toBe('html');
  });

  it('opens a log in the code viewer, which colours it, unless the text viewer is asked for', () => {
    expect(resolve('server.log')).toBe('code');
    expect(resolve('notes.txt')).toBe('text');
  });

  it('returns null for unknown files', () => {
    expect(resolve('archive.zip')).toBeNull();
    expect(resolve('https://example.com/folder.d/file')).toBeNull();
  });
});

describe('load', () => {
  it('rejects an unknown viewer id', async () => {
    await expect(load('nope')).rejects.toThrow('Unknown viewer');
  });
});
