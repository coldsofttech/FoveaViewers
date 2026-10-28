import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentName, load, registry, resolve } from './registry.js';

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

describe('registry and the viewer packages', () => {
  // The packages are not imported (they need the built shared package), so their entry files are read.
  // The ids come from the registry, not from a user.
  const entryOf = (/** @type {string} */ id) =>
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFileSync(join(import.meta.dirname, '..', '..', `fovea-${id}`, 'src', 'index.js'), 'utf8');

  it.each(registry.map((entry) => [entry.id, entry]))(
    'the %s viewer exports the component the registry looks for',
    (id, entry) => {
      expect(entryOf(id)).toMatch(
        // eslint-disable-next-line security/detect-non-literal-regexp
        new RegExp(String.raw`export \{[^}]*\b${componentName(id)}\b[^}]*\}`),
      );
      expect(entry.id).toBe(id);
    },
  );

  it.each(registry.map((entry) => [entry.id, entry]))(
    'the %s viewer opens the same extensions as the registry says',
    (id, entry) => {
      const listed = /extensions:\s*\[([^\]]*)\]/.exec(entryOf(id))?.[1];
      // The code viewer builds its list from its languages instead of writing it out.
      if (listed === undefined) return;
      const own = [...listed.matchAll(/'([^']+)'/g)].map((match) => match[1]);
      expect([...own].sort()).toEqual([...entry.extensions].sort());
    },
  );
});
