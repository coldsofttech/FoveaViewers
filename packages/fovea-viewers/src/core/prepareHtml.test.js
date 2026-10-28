import { describe, expect, it } from 'vitest';
import { inHead, policy, prepareHtml } from './prepareHtml.js';

const PAGE =
  '<!doctype html><html><head><title>T</title><meta http-equiv="refresh" content="0; url=https://evil.example"><style>p{color:red}</style></head><body><p>Hi</p><img src="https://example.com/a.png"><a href="https://e.com/x">link</a></body></html>';

describe('prepareHtml (default)', () => {
  it('removes scripts, event handlers, frames, objects, bases and a refresh', () => {
    const out = prepareHtml(
      '<head><base href="https://x.example/"><meta http-equiv="refresh" content="0;url=https://x.example"></head><body onload="x()"><script>1</script><iframe src="https://x.example"></iframe><object data="a"></object><embed src="a"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onerror="x()"><p>ok</p></body>',
    );
    expect(out).not.toMatch(
      /<script|onload|onerror|<iframe|<object|<embed|<base\b|http-equiv="refresh"/i,
    );
    expect(out).toContain('<p>ok</p>');
    expect(out).toContain('<img');
  });

  it('keeps the page’s own styles and its doctype', () => {
    const out = prepareHtml(PAGE);
    expect(out).toContain('<style>p{color:red}</style>');
    expect(out.toLowerCase().startsWith('<!doctype html>')).toBe(true);
  });

  it('puts the policy first in the head, so nothing loads before it', () => {
    const out = prepareHtml(PAGE);
    expect(out).toMatch(
      /<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'/,
    );
    expect(out).not.toMatch(/content="[^"]*https?:/);
  });

  it('does not let a link run code', () => {
    const out = prepareHtml(
      '<body><a href="javascript:alert(1)">x</a><a href="https://e.com">y</a></body>',
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="https://e.com"');
  });

  it('keeps a stylesheet link only when styles are allowed, and only to the web', () => {
    const page =
      '<head><link rel="stylesheet" href="https://e.com/a.css"><link rel="stylesheet" href="file:///a.css"><link rel="icon" href="https://e.com/i.png"></head><body></body>';
    expect(prepareHtml(page)).not.toContain('<link');
    const allowed = prepareHtml(page, { allowStyles: true });
    expect(allowed).toContain('href="https://e.com/a.css"');
    expect(allowed).not.toContain('file:///');
    expect(allowed).not.toContain('rel="icon"');
  });

  it('adds the address the page came from as its base, and lets only that origin be one', () => {
    const out = prepareHtml(PAGE, { base: 'https://example.com/dir/page.html' });
    expect(out).toContain('<base href="https://example.com/dir/page.html">');
    expect(out).toMatch(/base-uri https:\/\/example\.com"/);
  });

  it('ignores a base that is not a web address, and escapes one that is', () => {
    expect(prepareHtml(PAGE, { base: 'blob:null/123' })).not.toContain('<base');
    expect(prepareHtml('<body></body>', { base: 'https://e.com/?a="b"&c' })).toContain(
      'href="https://e.com/?a=&quot;b&quot;&amp;c"',
    );
  });
});

describe('prepareHtml (scripts allowed)', () => {
  it('keeps inline scripts, removes a base and a refresh, and still adds the policy', () => {
    const out = prepareHtml(
      '<head><base href="https://x.example/"></head><body><script>run()</script></body>',
      { allowScripts: true },
    );
    expect(out).toContain('<script>run()</script>');
    expect(out).not.toMatch(/<base\b/i);
    expect(out).toContain("script-src 'unsafe-inline'");
    expect(out).toContain("default-src 'none'");
  });

  it('takes the address out of links when asked, and keeps their text and the doctype', () => {
    const out = prepareHtml(PAGE, { allowScripts: true, stripLinks: true });
    expect(out).toContain('>link</a>');
    expect(out).not.toContain('https://e.com/x');
    expect(out.toLowerCase().startsWith('<!doctype html>')).toBe(true);
  });

  it('leaves links alone otherwise', () => {
    expect(prepareHtml(PAGE, { allowScripts: true })).toContain('href="https://e.com/x"');
  });
});

describe('policy', () => {
  it('lets nothing load but what is inside the file', () => {
    const p = policy();
    expect(p).toContain("default-src 'none'");
    expect(p).toContain('img-src data:;');
    expect(p).not.toMatch(/https?:/);
    expect(p).not.toContain('script-src');
    expect(p).toContain("form-action 'none'");
    expect(p).toContain("base-uri 'none'");
  });

  it('opens pictures, styles and scripts one at a time', () => {
    expect(policy({ allowImages: true })).toContain('img-src data: http: https:');
    expect(policy({ allowImages: true })).toContain('font-src data:;');
    expect(policy({ allowStyles: true })).toContain("style-src 'unsafe-inline' http: https:");
    expect(policy({ allowStyles: true })).toContain('font-src data: http: https:');
    expect(policy({ allowStyles: true })).toContain('img-src data:;');
    expect(policy({ allowScripts: true })).toContain("script-src 'unsafe-inline'");
    expect(policy({ allowScripts: true })).not.toMatch(/script-src[^;]*https?:/);
  });
});

describe('inHead', () => {
  it('goes at the start of an existing head, or makes one', () => {
    expect(inHead('<html><head lang="en"><title>x</title></head></html>', '<m>')).toBe(
      '<html><head lang="en"><m><title>x</title></head></html>',
    );
    expect(inHead('<html><body></body></html>', '<m>')).toBe(
      '<html><head><m></head><body></body></html>',
    );
    expect(inHead('<!DOCTYPE html><p>x</p>', '<m>')).toBe(
      '<!DOCTYPE html><head><m></head><p>x</p>',
    );
    expect(inHead('<p>x</p>', '<m>')).toBe('<head><m></head><p>x</p>');
  });
});
