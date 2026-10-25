import { describe, expect, it } from 'vitest';
import { CssHighlighter, START, formatCss, scan } from './css.js';
import { locateWords } from './locate.js';

const kinds = (line, from = START) =>
  scan(line, from)
    .segments.filter(([kind]) => kind !== 'punct')
    .map(([kind, text]) => [kind, text.trim()]);

const colour = (lines) => {
  const highlighter = new CssHighlighter(lines);
  return lines.map((_, i) => highlighter.segments(i));
};

describe('scan', () => {
  it('colours a rule: selector, property, values', () => {
    const stylesheet = ['.card > a:hover {', '  color: #fff;', '  margin: 0 -1.5em;', '}'];
    const [open, color, margin, close] = colour(stylesheet);
    expect(
      open
        .filter(([k]) => k === 'selector')
        .map(([, t]) => t.trim())
        .join(''),
    ).toContain('.card');
    expect(color.map(([k, t]) => [k, t.trim()]).filter(([k]) => k !== 'punct')).toEqual([
      ['property', 'color'],
      ['number', '#fff'],
    ]);
    expect(margin.map(([k, t]) => [k, t.trim()]).filter(([k]) => k !== 'punct')).toEqual([
      ['property', 'margin'],
      ['number', '0'],
      ['number', '-1.5em'],
    ]);
    expect(close).toEqual([['punct', '}']]);
  });

  it('keeps the line whole', () => {
    for (const line of ['a{b:c;d:e(f)}', '  @media (min-width: 600px) {', '/* x */ p { q: "r" }']) {
      expect(
        scan(line, START)
          .segments.map(([, t]) => t)
          .join(''),
      ).toBe(line);
    }
  });

  it('knows functions, strings, addresses, variables and !important', () => {
    const line = 'a { background: url(pic.png) var(--main, "x") !important; }';
    const found = kinds(line);
    expect(found).toContainEqual(['function', 'url']);
    expect(found).toContainEqual(['string', 'pic.png']);
    expect(found).toContainEqual(['function', 'var']);
    expect(found).toContainEqual(['property', '--main']);
    expect(found).toContainEqual(['string', '"x"']);
    expect(found).toContainEqual(['important', '!important']);
  });

  it('knows at-rules, and that a media block holds rules while a font-face holds declarations', () => {
    const lines = [
      '@media (min-width: 600px) {',
      '  .a { color: red }',
      '}',
      '@font-face {',
      '  font-family: X;',
      '}',
    ];
    const rows = colour(lines);
    expect(rows[0][0]).toEqual(['atrule', '@media']);
    expect(rows[0].map(([k, t]) => [k, t.trim()])).toContainEqual(['number', '600px']);
    expect(rows[1].some(([k, t]) => k === 'selector' && t.includes('.a'))).toBe(true);
    expect(rows[1].some(([k, t]) => k === 'property' && t === 'color')).toBe(true);
    expect(rows[3][0]).toEqual(['atrule', '@font-face']);
    expect(rows[4].some(([k, t]) => k === 'property' && t === 'font-family')).toBe(true);
  });

  it('carries a comment over lines', () => {
    const rows = colour(['/* one', ' two', ' three */ a { b: c }']);
    expect(rows[1]).toEqual([['comment', ' two']]);
    expect(rows[2][0]).toEqual(['comment', ' three */']);
    expect(rows[2].some(([k, t]) => k === 'selector' && t === 'a')).toBe(true);
  });

  it('carries a value over lines, and nested rules inside a rule', () => {
    const rows = colour([
      'a {',
      '  font-family: A,',
      '    B, serif;',
      '  &:hover { color: red }',
      '}',
    ]);
    expect(rows[2].some(([k, t]) => k === 'value' && t === 'serif')).toBe(true);
    expect(rows[2].some(([k]) => k === 'property')).toBe(false);
    expect(rows[3].some(([k, t]) => k === 'selector' && t.includes('&:hover'))).toBe(true);
    expect(rows[3].some(([k, t]) => k === 'property' && t === 'color')).toBe(true);
  });

  it('copes with what is not CSS', () => {
    expect(() =>
      colour(['}}}', '{{{', '"unterminated', "'x", '/*', '*/ */', '@', '']),
    ).not.toThrow();
  });

  it('finds the state of a line far down, and of an earlier one again', () => {
    const lines = Array.from({ length: 20000 }, (_, i) => (i % 2 ? '  color: red;' : `.r${i} {`));
    lines.splice(10001, 0, '/* open');
    const h = new CssHighlighter(lines);
    expect(h.segments(10002)[0][0]).toBe('comment');
    expect(h.segments(3).find(([kind]) => kind !== 'punct')[0]).toBe('property');
    expect(h.starts.length).toBeGreaterThan(10002);
  });
});

describe('formatCss', () => {
  it('puts a minified sheet one declaration to a line, indented by block', () => {
    expect(formatCss('a{color:red;margin:0}@media (x){b{top:1px}}')).toBe(
      [
        'a {',
        '  color:red;',
        '  margin:0',
        '}',
        '@media (x) {',
        '  b {',
        '    top:1px',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('leaves strings, comments and addresses alone', () => {
    const out = formatCss(
      'a{content:"a;b{c}";background:url(data:image/png;base64,AAA=)}/* x;y */',
    );
    expect(out).toContain('content:"a;b{c}";');
    expect(out).toContain('background:url(data:image/png;base64,AAA=)');
    expect(out).toContain('/* x;y */');
  });

  it('is quick on a long minified sheet', () => {
    const big = Array.from({ length: 60000 }, (_, i) => `.c${i}{color:red;top:${i}px}`).join('');
    const started = performance.now();
    const out = formatCss(big);
    expect(out.split('\n').length).toBe(60000 * 4);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('copes with unbalanced input', () => {
    expect(() => formatCss('}}} a { b')).not.toThrow();
    expect(formatCss('')).toBe('');
  });
});

describe('locateWords', () => {
  it('finds the words where the file has them, whatever its spacing', () => {
    const file = '.card   {\n  color:\n   red;\n}\n';
    const found = locateWords(file, { matched: '.card { color: red;' });
    expect(found.line).toBe(1);
    expect(found.column).toBe(1);
    expect(file.slice(found.offset, found.end)).toBe('.card   {\n  color:\n   red;');
  });

  it('chooses the occurrence whose surroundings match, and says nothing when not found', () => {
    const file = 'a { color: red }\nb { color: blue }';
    expect(locateWords(file, { before: 'b { ', matched: 'color', after: ': blue }' }).line).toBe(2);
    expect(locateWords(file, { matched: 'zebra' })).toBeNull();
  });
});
