import { describe, expect, it } from 'vitest';
import { LANGUAGES, keyBefore, languageOf, languageSpec } from './languages.js';
import { codeTheme, darkCode, lightCode } from './themes.js';
import { meta } from './index.js';

describe('languageOf', () => {
  it('works out the language from a file name or a URL', () => {
    expect(languageOf(new File(['x'], 'main.rs'))).toBe('rs');
    expect(languageOf('https://example.com/src/app.TSX?raw=1#top')).toBe('tsx');
    expect(languageOf('server.log')).toBe('log');
    expect(languageOf('include/util.h')).toBe('c');
    expect(languageOf('src/util.cpp')).toBe('cpp');
    expect(languageOf('data.jsonl')).toBe('ndjson');
    expect(languageOf('run.sh')).toBe('sh');
  });

  it('says nothing for an unknown extension, no extension, or something that is not a name', () => {
    expect(languageOf('archive.zip')).toBeNull();
    expect(languageOf('Makefile')).toBeNull();
    expect(languageOf('https://example.com/dir.d/file')).toBeNull();
    expect(languageOf(new Blob(['x']))).toBeNull();
    expect(languageOf(new ArrayBuffer(1))).toBeNull();
  });

  it('does not take HTML, which has its own viewer', () => {
    expect(languageOf('index.html')).toBeNull();
    expect(LANGUAGES.html).toBeUndefined();
  });
});

describe('LANGUAGES', () => {
  it('gives every extension to one language only', () => {
    const seen = new Map();
    for (const [id, spec] of Object.entries(LANGUAGES)) {
      for (const extension of spec.extensions) {
        expect(
          seen.get(extension),
          `.${extension} is in ${id} and ${seen.get(extension)}`,
        ).toBeUndefined();
        seen.set(extension, id);
      }
    }
  });

  it('gives every language a name and a way to colour it', () => {
    for (const spec of Object.values(LANGUAGES)) {
      expect(spec.label).toBeTruthy();
      expect(typeof spec.Highlighter).toBe('function');
    }
  });
});

describe('meta', () => {
  it('lists the extensions of every language', () => {
    expect(meta.id).toBe('code');
    expect(meta.extensions).toEqual(expect.arrayContaining(['js', 'py', 'cpp', 'log', 'json']));
    expect(meta.extensions).not.toContain('html');
  });
});

describe('keyBefore', () => {
  it('takes the last name of a flattened path', () => {
    expect(keyBefore('server.ports[0]: ')).toBe('ports');
    expect(keyBefore('catalog/book@id: ')).toBe('id');
    expect(keyBefore('no key here')).toBeNull();
  });

  it('needs the name right before the colon, and ignores space after it', () => {
    expect(keyBefore('a:b:')).toBe('a:b');
    expect(keyBefore('key: \n ')).toBe('key');
    expect(keyBefore('key :')).toBeNull();
    expect(keyBefore(':')).toBeNull();
    expect(keyBefore(undefined)).toBeNull();
  });

  it('is quick on a very long line with no colon', () => {
    const started = performance.now();
    expect(keyBefore('x'.repeat(200000))).toBeNull();
    expect(keyBefore(`${'x'.repeat(200000)}: `)).toBe('x'.repeat(200000));
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('codeTheme', () => {
  it('uses Light+ by default, Dark+ for dark, and your colours over Light+', () => {
    expect(codeTheme(undefined)).toBe(lightCode);
    expect(codeTheme('light')).toBe(lightCode);
    expect(codeTheme('dark')).toBe(darkCode);
    const custom = codeTheme({ background: 'red', 'token-keyword': 'blue' });
    expect(custom.background).toBe('red');
    expect(custom['token-keyword']).toBe('blue');
    expect(custom['token-string']).toBe(lightCode['token-string']);
  });

  it('colours the same kinds of token in both themes', () => {
    expect(Object.keys(darkCode).sort()).toEqual(Object.keys(lightCode).sort());
  });
});

describe('languageSpec', () => {
  it('finds a language by its key and nothing else', () => {
    expect(languageSpec('py')?.label).toBe('Python');
    expect(languageSpec('constructor')).toBeUndefined();
    expect(languageSpec('__proto__')).toBeUndefined();
    expect(languageSpec('')).toBeUndefined();
    expect(languageSpec(null)).toBeUndefined();
  });
});
