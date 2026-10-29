/* eslint-disable security/detect-object-injection -- the tests read rows of colours by position */
import { describe, expect, it } from 'vitest';
import { JsHighlighter, formatJs } from './js.js';
import { JsonHighlighter, formatJson } from './json.js';
import { XmlHighlighter, formatXml, tokenize } from './xml.js';
import {
  CSharpHighlighter,
  GoHighlighter,
  JavaHighlighter,
  PhpHighlighter,
  PowerShellHighlighter,
  PythonHighlighter,
  RubyHighlighter,
  RustHighlighter,
  ShellHighlighter,
} from './code.js';
import { IniHighlighter } from './ini.js';
import { LogHighlighter } from './log.js';
import { RstHighlighter } from './rst.js';
import { SqlHighlighter } from './sql.js';
import { TomlHighlighter } from './toml.js';
import { YamlHighlighter } from './yaml.js';
import { locateWords } from './locate.js';

const colour = (Highlighter, lines) => {
  const h = new Highlighter(lines);
  return lines.map((_, i) => h.segments(i));
};
const text = (segments) => segments.map(([, t]) => t).join('');

describe('JSON', () => {
  it('colours keys, strings, numbers and constants', () => {
    const [row] = colour(JsonHighlighter, [
      '  "name": "Ada", "age": -3.5e2, "ok": true, "x": null, "l": [1]',
    ]);
    expect(row).toContainEqual(['key', '"name"']);
    expect(row).toContainEqual(['string', '"Ada"']);
    expect(row).toContainEqual(['number', '-3.5e2']);
    expect(row).toContainEqual(['constant', 'true']);
    expect(row).toContainEqual(['constant', 'null']);
    expect(text(row)).toBe('  "name": "Ada", "age": -3.5e2, "ok": true, "x": null, "l": [1]');
  });

  it('keeps any line whole, even a broken one', () => {
    for (const line of ['{"a": "unterminated', '}}]]', '"\\"", "\\\\"', '', 'nul tru -']) {
      expect(text(colour(JsonHighlighter, [line])[0])).toBe(line);
    }
  });

  it('lays a minified file out, exactly as written', () => {
    const minified =
      '{"a":[1,2,{"b":null}],"e":{},"l":[],"s":"x,y:{z}","a":9007199254740993,"1":2}';
    expect(formatJson(minified)).toBe(
      [
        '{',
        '  "a": [',
        '    1,',
        '    2,',
        '    {',
        '      "b": null',
        '    }',
        '  ],',
        '  "e": {},',
        '  "l": [],',
        '  "s": "x,y:{z}",',
        '  "a": 9007199254740993,',
        '  "1": 2',
        '}',
      ].join('\n'),
    );
    expect(() => formatJson('}}{[')).not.toThrow();
    expect(formatJson('')).toBe('');
  });

  it('is quick on a long minified file', () => {
    const big = `[${Array.from({ length: 80000 }, (_, i) => `{"id":${i},"v":"x"}`).join(',')}]`;
    const started = performance.now();
    expect(formatJson(big).split('\n').length).toBe(80000 * 4 + 2);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

describe('YAML', () => {
  const doc = [
    '# settings',
    '---',
    'server:',
    '  host: "localhost"   # where',
    '  ports: [8080, 8081]',
    '  debug: yes',
    '  ratio: 0.5',
    'items:',
    '  - name: a',
    '    tags: &t [x, y]',
    '  - *t',
    'text: |',
    '  line one',
    '  key: not a key',
    '',
    '  line two',
    'after: done',
  ];
  const rows = colour(YamlHighlighter, doc);

  it('colours comments, keys, strings, numbers, constants and anchors', () => {
    expect(rows[0]).toEqual([['comment', '# settings']]);
    expect(rows[1][0]).toEqual(['punct', '---']);
    expect(rows[3]).toContainEqual(['key', 'host']);
    expect(rows[3]).toContainEqual(['string', '"localhost"']);
    expect(rows[3]).toContainEqual(['comment', '# where']);
    expect(rows[4]).toContainEqual(['number', '8080']);
    expect(rows[5]).toContainEqual(['constant', 'yes']);
    expect(rows[6]).toContainEqual(['number', '0.5']);
    expect(rows[8]).toContainEqual(['key', 'name']);
    expect(rows[9]).toContainEqual(['function', '&t']);
    expect(rows[10]).toContainEqual(['function', '*t']);
  });

  it('carries a block scalar over its lines (blank ones too) and ends it', () => {
    expect(rows[11]).toContainEqual(['function', '|']);
    expect(rows[12]).toEqual([['string', '  line one']]);
    expect(rows[13]).toEqual([['string', '  key: not a key']]);
    expect(rows[14]).toEqual([['string', '']].filter(([, t]) => t));
    expect(rows[15]).toEqual([['string', '  line two']]);
    expect(rows[16]).toContainEqual(['key', 'after']);
  });

  it('keeps every line whole and copes with odd input', () => {
    for (const line of doc) expect(text(colour(YamlHighlighter, [line])[0])).toBe(line);
    expect(() =>
      colour(YamlHighlighter, ['- - - x', ': :', '"', "'a", '? k', '{[', '|', '>-']),
    ).not.toThrow();
    const lines = Array.from({ length: 20000 }, (_, i) =>
      i === 7000 ? 'k: |' : i > 7000 && i < 7010 ? '  body' : 'a: 1',
    );
    expect(new YamlHighlighter(lines).segments(7005)).toEqual([['string', '  body']]);
  });
});

describe('TOML', () => {
  const doc = [
    '# project',
    '[package]',
    'name = "vethuq"  # the name',
    "version = '1.2.0'",
    'build = 42',
    'ratio = -3.5e2',
    'public = true',
    'released = 2026-10-14T10:00:00Z',
    'authors = ["Ada", "Grace"]',
    'point = { x = 1, y = 2 }',
    '[[bin]]',
    'a.b."c d" = 0x1F',
    'text = """',
    'line one [not.a.header]',
    'key = "not a key"',
    '""" # done',
    "raw = '''",
    'still raw """',
    "''' ",
    'after = 1',
  ];
  const rows = colour(TomlHighlighter, doc);

  it('colours comments, tables, keys, strings, numbers, dates and constants', () => {
    expect(rows[0]).toEqual([['comment', '# project']]);
    expect(rows[1]).toEqual([['function', '[package]']]);
    expect(rows[2]).toContainEqual(['key', 'name']);
    expect(rows[2]).toContainEqual(['string', '"vethuq"']);
    expect(rows[2]).toContainEqual(['comment', '# the name']);
    expect(rows[3]).toContainEqual(['string', "'1.2.0'"]);
    expect(rows[4]).toContainEqual(['number', '42']);
    expect(rows[5]).toContainEqual(['number', '-3.5e2']);
    expect(rows[6]).toContainEqual(['constant', 'true']);
    expect(rows[7]).toContainEqual(['number', '2026-10-14T10:00:00Z']);
    expect(rows[8]).toContainEqual(['string', '"Ada"']);
    expect(rows[9]).toContainEqual(['key', 'x']);
    expect(rows[10]).toEqual([['function', '[[bin]]']]);
    expect(rows[11]).toContainEqual(['key', 'a.b."c d"']);
    expect(rows[11]).toContainEqual(['number', '0x1F']);
  });

  it('carries a multi-line string over its lines and ends it', () => {
    expect(rows[12]).toContainEqual(['string', '"""']);
    expect(rows[13]).toEqual([['string', 'line one [not.a.header]']]);
    expect(rows[14]).toEqual([['string', 'key = "not a key"']]);
    expect(rows[15]).toContainEqual(['string', '"""']);
    expect(rows[15]).toContainEqual(['comment', '# done']);
    expect(rows[17]).toEqual([['string', 'still raw """']]);
    expect(rows[19]).toContainEqual(['key', 'after']);
  });

  it('keeps every line whole and copes with odd input', () => {
    for (const line of doc) expect(text(colour(TomlHighlighter, [line])[0])).toBe(line);
    for (const line of ['= =', '[', ']]', '"', "'a", '{[', '"""', 'a = ,,', '[[]]=', '#']) {
      expect(text(colour(TomlHighlighter, [line])[0])).toBe(line);
    }
    const lines = Array.from({ length: 20000 }, (_, i) =>
      i === 7000 ? 'k = """' : i > 7000 && i < 7010 ? 'body' : 'a = 1',
    );
    expect(new TomlHighlighter(lines).segments(7005)).toEqual([['string', 'body']]);
  });
});

describe('INI', () => {
  const doc = [
    '; settings',
    '[server]',
    'host = localhost',
    'port: 8080',
    'debug = yes',
    '  continued',
    'flag',
  ];
  const rows = colour(IniHighlighter, doc);

  it('colours comments, sections, keys and values', () => {
    expect(rows[0]).toEqual([['comment', '; settings']]);
    expect(rows[1]).toEqual([['function', '[server]']]);
    expect(rows[2]).toContainEqual(['key', 'host']);
    expect(rows[2]).toContainEqual(['string', 'localhost']);
    expect(rows[3]).toContainEqual(['number', '8080']);
    expect(rows[4]).toContainEqual(['constant', 'yes']);
    expect(rows[5]).toContainEqual(['string', 'continued']);
    expect(rows[6]).toEqual([['key', 'flag']]);
  });

  it('keeps every line whole and copes with odd input', () => {
    for (const line of [...doc, '[', '=', '=x', '[a]]b', ':', '   ', '#']) {
      expect(text(colour(IniHighlighter, [line])[0])).toBe(line);
    }
  });
});

describe('SQL', () => {
  const doc = [
    '-- users',
    "SELECT name, count(*) FROM users WHERE id = 42 AND ok = 'it''s' /* c */;",
    '/* a block',
    '   comment */ INSERT INTO t VALUES (1.5, NULL, "Col", true);',
    'CREATE TABLE x (id INT);',
  ];
  const rows = colour(SqlHighlighter, doc);

  it('colours comments, keywords, types, functions, strings, numbers and constants', () => {
    expect(rows[0]).toEqual([['comment', '-- users']]);
    expect(rows[1]).toContainEqual(['keyword', 'SELECT']);
    expect(rows[1]).toContainEqual(['function', 'count']);
    expect(rows[1]).toContainEqual(['number', '42']);
    expect(rows[1]).toContainEqual(['string', "'it''s'"]);
    expect(rows[1]).toContainEqual(['comment', '/* c */']);
    expect(rows[3]).toContainEqual(['number', '1.5']);
    expect(rows[3]).toContainEqual(['constant', 'NULL']);
    expect(rows[3]).toContainEqual(['identifier', '"Col"']);
    expect(rows[4]).toContainEqual(['storage', 'INT']);
  });

  it('carries a block comment over its lines and ends it', () => {
    expect(rows[2]).toEqual([['comment', '/* a block']]);
    expect(rows[3][0]).toEqual(['comment', '   comment */']);
    expect(rows[3]).toContainEqual(['keyword', 'INSERT']);
  });

  it('keeps every line whole and copes with odd input', () => {
    for (const line of doc) expect(text(colour(SqlHighlighter, [line])[0])).toBe(line);
    for (const line of ["'", '"a', '/*', '*/', '--', '$$ x $$', '\u00e9t\u00e9', '`', '1e']) {
      expect(text(colour(SqlHighlighter, [line])[0])).toBe(line);
    }
    const lines = Array.from({ length: 20000 }, (_, i) =>
      i === 7000 ? '/* open' : i === 7010 ? 'close */' : 'select 1;',
    );
    expect(new SqlHighlighter(lines).segments(7005)).toEqual([['comment', 'select 1;']]);
  });
});

describe('reStructuredText', () => {
  const doc = [
    'Title',
    '=====',
    ':Author: Ada',
    '.. note:: Careful with ``code`` and **bold**',
    '.. a comment',
    '- item with :ref:`guide <g>` and `link <u>`_',
  ];
  const rows = colour(RstHighlighter, doc);

  it('colours underlines, fields, directives, comments and inline markup', () => {
    expect(rows[1]).toEqual([['atrule', '=====']]);
    expect(rows[2]).toContainEqual(['key', ':Author:']);
    expect(rows[3]).toContainEqual(['function', 'note::']);
    expect(rows[3]).toContainEqual(['string', '``code``']);
    expect(rows[3]).toContainEqual(['keyword', '**bold**']);
    expect(rows[4]).toEqual([['comment', '.. a comment']]);
    expect(rows[5]).toContainEqual(['punct', '-']);
    expect(rows[5]).toContainEqual(['function', ':ref:`guide <g>`']);
    expect(rows[5]).toContainEqual(['function', '`link <u>`_']);
  });

  it('keeps every line whole and copes with odd input', () => {
    for (const line of [...doc, '``', '**', ':', '..', '`a`__', '   ', '* *']) {
      expect(text(colour(RstHighlighter, [line])[0])).toBe(line);
    }
  });
});

describe('Log', () => {
  const doc = [
    '2026-10-14 10:00:00,123 ERROR [main] failed id=7 "boom" after 3.5s',
    '10:00:01 WARNING disk',
    '2026-10-14T10:00:02Z INFO started',
    'DEBUG x',
  ];
  const rows = colour(LogHighlighter, doc);

  it('colours times, levels, brackets, pairs, strings and numbers', () => {
    expect(rows[0]).toContainEqual(['number', '2026-10-14 10:00:00,123']);
    expect(rows[0]).toContainEqual(['regexp', 'ERROR']);
    expect(rows[0]).toContainEqual(['identifier', '[main]']);
    expect(rows[0]).toContainEqual(['key', 'id']);
    expect(rows[0]).toContainEqual(['string', '"boom"']);
    expect(rows[1]).toContainEqual(['selector', 'WARNING']);
    expect(rows[2]).toContainEqual(['storage', 'INFO']);
    expect(rows[3]).toContainEqual(['comment', 'DEBUG']);
  });

  it('keeps every line whole and copes with odd input', () => {
    for (const line of [...doc, '', '[', '"', "'a", '=', 'a=', '\u00e9']) {
      expect(text(colour(LogHighlighter, [line])[0])).toBe(line);
    }
  });
});

describe('source code', () => {
  const cases = {
    Python: [
      PythonHighlighter,
      [
        '# add',
        'def add(a, b=2):  # sum',
        '    s = """doc',
        '    more"""; return a + b if a is None else 0x1F',
      ],
      [
        [0, 'comment', '# add'],
        [1, 'keyword', 'def'],
        [1, 'function', 'add'],
        [1, 'comment', '# sum'],
        [2, 'string', '"""doc'],
        [3, 'string', '    more"""'],
        [3, 'keyword', 'return'],
        [3, 'constant', 'None'],
        [3, 'number', '0x1F'],
      ],
    ],
    Java: [
      JavaHighlighter,
      [
        '/** doc',
        ' * more */',
        '@Override public int add(int a) { return a; } // x',
        'String s = "a\\"b";',
      ],
      [
        [0, 'comment', '/** doc'],
        [1, 'comment', ' * more */'],
        [2, 'keyword', 'public'],
        [2, 'storage', 'int'],
        [2, 'comment', '// x'],
        [3, 'string', '"a\\"b"'],
      ],
    ],
    'C#': [
      CSharpHighlighter,
      ['public async Task<int> Add(int a) => a + 1; // x', 'var s = "hi"; bool b = true;'],
      [
        [0, 'keyword', 'public'],
        [0, 'keyword', 'async'],
        [0, 'function', 'Add'],
        [1, 'keyword', 'var'],
        [1, 'storage', 'bool'],
        [1, 'constant', 'true'],
      ],
    ],
    Go: [
      GoHighlighter,
      ['func add(a, b int) int { // sum', '\treturn `raw', 'text` + "s"'],
      [
        [0, 'keyword', 'func'],
        [0, 'function', 'add'],
        [0, 'storage', 'int'],
        [1, 'keyword', 'return'],
        [1, 'string', '`raw'],
        [2, 'string', 'text`'],
      ],
    ],
    Rust: [
      RustHighlighter,
      [
        "fn longest<'a>(x: &'a str, c: char) -> i32 { let c = 'x'; 42 }",
        '/* open',
        'close */ let y = 1;',
      ],
      [
        [0, 'keyword', 'fn'],
        [0, 'storage', "'a"],
        [0, 'storage', 'str'],
        [0, 'string', "'x'"],
        [0, 'number', '42'],
        [1, 'comment', '/* open'],
        [2, 'comment', 'close */'],
        [2, 'keyword', 'let'],
      ],
    ],
    PHP: [
      PhpHighlighter,
      ['<?php', '$x = $this->add($a, "s"); // c', '# hash', '?>'],
      [
        [0, 'storage', '<?php'],
        [1, 'identifier', '$x'],
        [1, 'identifier', '$a'],
        [1, 'string', '"s"'],
        [1, 'comment', '// c'],
        [2, 'comment', '# hash'],
        [3, 'storage', '?>'],
      ],
    ],
    Ruby: [
      RubyHighlighter,
      ['=begin', 'a comment', '=end', 'def add(a) # x', '  @n = :sym; puts "s" if a.nil?', 'end'],
      [
        [0, 'comment', '=begin'],
        [1, 'comment', 'a comment'],
        [2, 'comment', '=end'],
        [3, 'keyword', 'def'],
        [3, 'comment', '# x'],
        [4, 'identifier', '@n'],
        [4, 'constant', ':sym'],
        [4, 'string', '"s"'],
        [5, 'keyword', 'end'],
      ],
    ],
    Shell: [
      ShellHighlighter,
      [
        '#!/bin/sh',
        'for f in $@; do echo "$f" ${HOME}; done # x',
        'if [ $# -gt 0 ]; then exit 1; fi',
      ],
      [
        [0, 'comment', '#!/bin/sh'],
        [1, 'keyword', 'for'],
        [1, 'identifier', '$@'],
        [1, 'storage', 'echo'],
        [1, 'identifier', '${HOME}'],
        [1, 'comment', '# x'],
        [2, 'identifier', '$#'],
        [2, 'keyword', 'then'],
      ],
    ],
    PowerShell: [
      PowerShellHighlighter,
      [
        '<# block',
        'still #> function Get-Thing { param($x) }',
        'Get-ChildItem -Path $env:HOME # c',
        '$s = @"',
        'here "quoted"',
        '"@',
      ],
      [
        [0, 'comment', '<# block'],
        [1, 'comment', 'still #>'],
        [1, 'keyword', 'function'],
        [1, 'identifier', '$x'],
        [2, 'function', 'Get-ChildItem'],
        [2, 'key', '-Path'],
        [2, 'comment', '# c'],
        [3, 'string', '@"'],
        [4, 'string', 'here "quoted"'],
        [5, 'string', '"@'],
      ],
    ],
  };

  for (const [name, [Highlighter, doc, expected]] of Object.entries(cases)) {
    it(`colours ${name}`, () => {
      const rows = colour(Highlighter, doc);
      for (const [line, kind, piece] of expected) {
        expect(rows[line], `${name} line ${line}`).toContainEqual([kind, piece]);
      }
    });

    it(`keeps every ${name} line whole and copes with odd input`, () => {
      const odd = ['"', "'a", '/*', '*/', '`', '$', '@', '{[(', '\\', '<#', '"@', '1e', '0x', ':'];
      for (const line of [...doc, ...odd]) {
        expect(text(colour(Highlighter, [line])[0])).toBe(line);
      }
      const lines = Array.from({ length: 20000 }, (_, i) => (i === 9000 ? doc[0] : 'x = 1'));
      expect(() => new Highlighter(lines).segments(15000)).not.toThrow();
    });
  }

  it('carries a Python triple-quoted string over its lines', () => {
    const lines = ['a = """x', 'def not_code(): pass', 'y"""', 'def real(): pass'];
    const rows = colour(PythonHighlighter, lines);
    expect(rows[1]).toEqual([['string', 'def not_code(): pass']]);
    expect(rows[3]).toContainEqual(['keyword', 'def']);
  });
});

describe('JavaScript', () => {
  const [row] = colour(JsHighlighter, [
    'export const total = items.map((x) => x * 2.5).filter(Boolean); // sum',
  ]);

  it('colours keywords, storage, functions, members, numbers, comments', () => {
    expect(row).toContainEqual(['keyword', 'export']);
    expect(row).toContainEqual(['storage', 'const']);
    expect(row).toContainEqual(['identifier', 'total']);
    expect(row).toContainEqual(['function', 'map']);
    expect(row).toContainEqual(['function', 'filter']);
    expect(colour(JsHighlighter, ['a.length + b.c'])[0]).toContainEqual(['member', 'length']);
    expect(row).toContainEqual(['number', '2.5']);
    expect(row).toContainEqual(['comment', '// sum']);
  });

  it('knows a function call, a string, a regex and a division', () => {
    const r = colour(JsHighlighter, [
      'run("a\\"b", `t`); const re = /ab+[/]c/gi; const q = a / b / c; return x /y/ 2;',
    ])[0];
    expect(r).toContainEqual(['function', 'run']);
    expect(r).toContainEqual(['string', '"a\\"b"']);
    expect(r).toContainEqual(['regexp', '/ab+[/]c/gi']);
    expect(r.filter(([k]) => k === 'regexp')).toHaveLength(1);
  });

  it('carries a block comment and a template literal over lines, with expressions inside', () => {
    const r = colour(JsHighlighter, [
      '/* one',
      ' two */ let a = `text ${ f({ k: 1 }) } more',
      'still template ${b} end`; let z = 1;',
    ]);
    expect(r[1][0]).toEqual(['comment', ' two */']);
    expect(r[1]).toContainEqual(['storage', 'let']);
    expect(r[1]).toContainEqual(['function', 'f']);
    expect(r[1].some(([k, t]) => k === 'string' && t.endsWith(' more'))).toBe(true);
    expect(r[2][0][0]).toBe('string');
    expect(r[2]).toContainEqual(['identifier', 'b']);
    expect(r[2]).toContainEqual(['storage', 'let']);
    expect(r[2]).toContainEqual(['number', '1']);
  });

  it('keeps every line whole', () => {
    for (const line of [
      '#!/usr/bin/env node',
      'a ? b : c',
      '`unterminated ${',
      '}}}',
      '/',
      '/*',
      '0x1F + 1_000n + .5e-3',
      '"x',
      '',
    ]) {
      expect(text(colour(JsHighlighter, [line])[0])).toBe(line);
    }
  });

  it('lays a minified script out roughly', () => {
    const out = formatJs(
      'function f(a,b){if(a){return b}else{for(let i=0;i<3;i++){g(`x;${i}`,"a;b",/;/)}}}f(1,2);',
    );
    expect(out).toBe(
      [
        'function f(a,b) {',
        '  if(a) {',
        '    return b',
        '  } else {',
        '    for(let i=0;i<3;i++) {',
        '      g(`x;${i}`,"a;b",/;/)',
        '    }',
        '  }',
        '}',
        'f(1,2);',
      ].join('\n'),
    );
    expect(formatJs('/* a;b */ x=1; // c;d\ny=2;')).toBe('/* a;b */\nx=1;\n// c;d\ny=2;');
    expect(() => formatJs('}}} ( ` /*')).not.toThrow();
  });

  it('is quick on a long minified bundle', () => {
    const big = Array.from({ length: 40000 }, (_, i) => `function f${i}(a){return a+${i};}`).join(
      '',
    );
    const started = performance.now();
    expect(formatJs(big).split('\n').length).toBe(40000 * 3);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

describe('XML', () => {
  const doc = [
    '<?xml version="1.0"?>',
    '<!-- a',
    ' note -->',
    '<ns:catalog xmlns:ns="u" lang=\'en\'>',
    '  <book id="7">Dune &amp; more</book>',
    '  <![CDATA[ <raw> ]]>',
    '  <br/>',
    '</ns:catalog>',
  ];
  const rows = colour(XmlHighlighter, doc);

  it('colours tags, attributes, values, entities, comments, CDATA and instructions', () => {
    expect(rows[0].every(([k]) => k === 'doctype')).toBe(true);
    expect(rows[2]).toEqual([['comment', ' note -->']]);
    expect(rows[3]).toContainEqual(['tag', 'ns:catalog']);
    expect(rows[3]).toContainEqual(['attribute', 'xmlns:ns']);
    expect(rows[3]).toContainEqual(['attrvalue', '"u"']);
    expect(rows[3]).toContainEqual(['attrvalue', "'en'"]);
    expect(rows[4]).toContainEqual(['entity', '&amp;']);
    expect(rows[4]).toContainEqual(['attribute', 'id']);
    expect(rows[5].some(([k, t]) => k === null && t.includes('<raw>'))).toBe(true);
    expect(rows[7]).toContainEqual(['tag', 'ns:catalog']);
  });

  it('keeps every line whole', () => {
    for (const line of doc) expect(text(colour(XmlHighlighter, [line])[0])).toBe(line);
    expect(() =>
      colour(XmlHighlighter, ['<', '</', '<a', '<!', '<?', '>>', '<![CDATA[']),
    ).not.toThrow();
  });

  it('lays a document out, keeping text-only elements on a line', () => {
    expect(
      formatXml(
        '<?xml version="1.0"?><catalog><book id="7"><title>Dune</title><empty/></book><!-- c --></catalog>',
      ),
    ).toBe(
      [
        '<?xml version="1.0"?>',
        '<catalog>',
        '  <book id="7">',
        '    <title>Dune</title>',
        '    <empty/>',
        '  </book>',
        '  <!-- c -->',
        '</catalog>',
      ].join('\n'),
    );
    expect(() => formatXml('</a><b')).not.toThrow();
    expect(formatXml('')).toBe('');
  });

  it('splits a document into tokens, leaving out a lone <', () => {
    expect(tokenize('<?xml v?><!DOCTYPE x><!-- c --><a b="1">t</a><![CDATA[<x>]]> < <b/>')).toEqual(
      [
        '<?xml v?>',
        '<!DOCTYPE x>',
        '<!-- c -->',
        '<a b="1">',
        't',
        '</a>',
        '<![CDATA[<x>]]>',
        ' ',
        ' ',
        '<b/>',
      ],
    );
    // Unfinished comments, CDATA and instructions fall back to the shorter readings.
    expect(tokenize('<!-- no end > x')).toEqual(['<!-- no end >', ' x']);
    expect(tokenize('<![CDATA[ no end > x')).toEqual(['<![CDATA[ no end >', ' x']);
    expect(tokenize('<? no end')).toEqual(['? no end']);
  });

  it('is quick on many unfinished comments, CDATA sections and instructions', () => {
    const started = performance.now();
    for (const unit of ['<!--', '<![CDATA[', '<?', '<a ']) {
      expect(tokenize(unit.repeat(50000)).length).toBeGreaterThan(0);
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('is quick on a long document', () => {
    const big = `<r>${Array.from({ length: 40000 }, (_, i) => `<i n="${i}">v</i>`).join('')}</r>`;
    const started = performance.now();
    expect(formatXml(big).split('\n').length).toBe(40002);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

describe('locateWords with a hint', () => {
  it('prefers the occurrence after the key, for a file indexed as key: value lines', () => {
    const json = '{"a": {"port": 80}, "b": {"ports": [8080]}, "c": {"port": 8080}}';
    const plain = locateWords(json, { matched: '8080' });
    expect(plain.offset).toBe(json.indexOf('8080'));
    const hinted = locateWords(json, { matched: '8080', hint: '"port"' });
    expect(hinted.offset).toBe(json.lastIndexOf('8080'));
    expect(locateWords(json, { matched: '8080', hint: 'nowhere' }).offset).toBe(plain.offset);
  });
});
