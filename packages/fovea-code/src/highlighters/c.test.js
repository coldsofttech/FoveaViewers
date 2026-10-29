/* eslint-disable security/detect-object-injection -- the tests read rows of colours by position */
import { describe, expect, it } from 'vitest';
import { CHighlighter, CppHighlighter } from './code.js';
import { LogHighlighter } from './log.js';

const colour = (Highlighter, lines) => {
  const h = new Highlighter(lines);
  return lines.map((_, i) => h.segments(i));
};
const text = (segments) => segments.map(([, t]) => t).join('');

describe('C', () => {
  const doc = [
    '#include <stdio.h>',
    '  #define MAX 10 /* limit */',
    '',
    'int main(void) {',
    '  const char *s = "hi\\n"; // greet',
    '  /* a block',
    '     comment */ return 0;',
    '}',
  ];
  const rows = colour(CHighlighter, doc);

  it('colours a directive and a header, and keeps the line whole', () => {
    expect(rows[0]).toEqual([
      ['atrule', '#include'],
      [null, ' '],
      ['string', '<stdio.h>'],
    ]);
    expect(rows[1]).toContainEqual(['atrule', '#define']);
    expect(rows[1]).toContainEqual(['number', '10']);
    expect(rows[1]).toContainEqual(['comment', '/* limit */']);
    doc.forEach((line, i) => expect(text(rows[i])).toBe(line));
  });

  it('colours keywords, types, strings, numbers and comments', () => {
    expect(rows[3]).toContainEqual(['storage', 'int']);
    expect(rows[3]).toContainEqual(['function', 'main']);
    expect(rows[3]).toContainEqual(['storage', 'void']);
    expect(rows[4]).toContainEqual(['keyword', 'const']);
    expect(rows[4]).toContainEqual(['string', '"hi\\n"']);
    expect(rows[4]).toContainEqual(['comment', '// greet']);
    expect(rows[6]).toContainEqual(['keyword', 'return']);
  });

  it('carries a block comment across lines', () => {
    expect(rows[5]).toContainEqual(['comment', '/* a block']);
    expect(rows[6][0]).toEqual(['comment', '     comment */']);
  });

  it('does not treat a hash inside a comment or string as a directive', () => {
    const lines = ['/*', '#include <x>', '*/', 'char *s = "#define";'];
    const found = colour(CHighlighter, lines);
    expect(found[1]).toEqual([['comment', '#include <x>']]);
    expect(found[3]).toContainEqual(['string', '"#define"']);
  });
});

describe('C++', () => {
  const doc = [
    '#include <vector>',
    'namespace app {',
    'template <typename T>',
    'class Box : public Base {',
    '  std::vector<int> items;',
    '  auto size() const noexcept -> size_t { return nullptr == p ? 0 : 1; }',
    '};',
  ];
  const rows = colour(CppHighlighter, doc);

  it('colours C++ keywords and types', () => {
    expect(rows[1]).toContainEqual(['keyword', 'namespace']);
    expect(rows[2]).toContainEqual(['keyword', 'template']);
    expect(rows[2]).toContainEqual(['keyword', 'typename']);
    expect(rows[3]).toContainEqual(['keyword', 'class']);
    expect(rows[3]).toContainEqual(['keyword', 'public']);
    expect(rows[4]).toContainEqual(['storage', 'vector']);
    expect(rows[5]).toContainEqual(['keyword', 'noexcept']);
    expect(rows[5]).toContainEqual(['constant', 'nullptr']);
    doc.forEach((line, i) => expect(text(rows[i])).toBe(line));
  });
});

describe('Log', () => {
  it('dims the frames of a stack trace and the lines that introduce one', () => {
    const lines = [
      '2026-10-25 08:00:03.657 [ERROR] api.server req=1 Timeout',
      '    at handler (src/server/handler.js:42:7)',
      'Caused by: Error: socket hang up',
      'Traceback (most recent call last):',
      '  File "app.py", line 3, in <module>',
    ];
    const rows = colour(LogHighlighter, lines);
    expect(rows[0]).toContainEqual(['regexp', '[ERROR]']);
    for (const row of rows.slice(1)) expect(row).toHaveLength(1);
    for (const [i, row] of rows.slice(1).entries()) {
      expect(row[0]).toEqual(['comment', lines[i + 1]]);
    }
  });
});
