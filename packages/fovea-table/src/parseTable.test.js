import { describe, expect, it } from 'vitest';
import { parseTable } from './parseTable.js';

describe('parseTable', () => {
  it('reads rows and cells', () => {
    expect(parseTable('a,b\n1,2\n')).toEqual({
      rows: [
        ['a', 'b'],
        ['1', '2'],
      ],
      delimiter: ',',
    });
  });

  it('reads quoted cells with delimiters, line breaks and quotes', () => {
    const { rows } = parseTable('a,b\r\n"x, y","line1\nline2"\r\n"say ""hi""",z');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
      ['say "hi"', 'z'],
    ]);
  });

  it('keeps empty cells and drops the blank line at the end', () => {
    expect(parseTable('a,,c\n,,\n\n').rows).toEqual([['a', '', 'c'], ['', '', ''], ['']]);
  });

  it('drops a byte order mark', () => {
    expect(parseTable('﻿a,b').rows).toEqual([['a', 'b']]);
  });

  it('finds the delimiter from the first line, ignoring quoted text', () => {
    expect(parseTable('a\tb\tc\n1\t2\t3').delimiter).toBe('\t');
    expect(parseTable('a;b\n1;2').delimiter).toBe(';');
    expect(parseTable('a|b\n1|2').delimiter).toBe('|');
    expect(parseTable('"a,b,c";d\n1;2').delimiter).toBe(';');
  });

  it('uses the delimiter it is given', () => {
    expect(parseTable('a,b;c', { delimiter: ';' }).rows).toEqual([['a,b', 'c']]);
  });

  it('gives no rows for empty text', () => {
    expect(parseTable('').rows).toEqual([]);
  });
});
