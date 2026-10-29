// @ts-nocheck -- ported from VethuQ as it was written; it is not type-checked yet.
/* eslint-disable security/detect-object-injection, security/detect-unsafe-regex -- these scanners index a line by computed positions, and their patterns are anchored at the cursor with no overlapping repeats, so they run in linear time. */
/**
 * Source code in many languages, from a table of what each one is made of. The state carried from
 * line to line is only which multi-line construct is open (a block comment, a triple-quoted or
 * backtick string, a here-string), so any window of lines can be coloured. A string that is not
 * closed on its line runs to the end of it, except where the language lets it run on.
 */
import { collector, highlighterFor, interner } from './highlighter.js';

const words = (list) => new Set(list.split(' '));
const SLASHES = { lineComments: ['//'], block: ['/*', '*/'] };
const NUMBER =
  /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?\w*|\.\d[\d_]*(?:[eE][-+]?\d+)?\w*)/;

/** What each language is made of. */
export const DEFINITIONS = {
  python: {
    lineComments: ['#'],
    multi: ['"""', "'''"],
    strings: ['"', "'"],
    keywords: words(
      'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case',
    ),
    constants: words('True False None'),
    storage: words('self cls int str float bool list dict set tuple bytes object'),
  },
  java: {
    ...SLASHES,
    multi: ['"""'],
    strings: ['"', "'"],
    keywords: words(
      'abstract assert break case catch class continue default do else enum extends final finally for if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record sealed permits yield',
    ),
    constants: words('true false null'),
    storage: words('int long short byte float double boolean char void String Object'),
  },
  csharp: {
    ...SLASHES,
    strings: ['"', "'"],
    keywords: words(
      'abstract as async await base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using virtual volatile while var record init get set yield when where',
    ),
    constants: words('true false null'),
    storage: words(
      'int long short byte sbyte uint ulong ushort float double decimal bool char string object void dynamic',
    ),
  },
  c: {
    ...SLASHES,
    strings: ['"', "'"],
    preprocessor: true,
    keywords: words(
      'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while _Alignas _Alignof _Atomic _Bool _Complex _Generic _Noreturn _Static_assert _Thread_local',
    ),
    constants: words('true false NULL EOF stdin stdout stderr'),
    storage: words(
      'int long short char float double void signed unsigned bool size_t ssize_t ptrdiff_t intptr_t uintptr_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t wchar_t FILE',
    ),
  },
  cpp: {
    ...SLASHES,
    strings: ['"', "'"],
    preprocessor: true,
    keywords: words(
      'alignas alignof and and_eq asm auto bitand bitor break case catch class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do dynamic_cast else enum explicit export extern final for friend goto if inline mutable namespace new noexcept not not_eq operator or or_eq override private protected public register reinterpret_cast requires return sizeof static static_assert static_cast struct switch template this thread_local throw try typedef typeid typename union using virtual volatile while xor xor_eq',
    ),
    constants: words('true false nullptr NULL'),
    storage: words(
      'int long short char float double void signed unsigned bool wchar_t char8_t char16_t char32_t size_t string wstring vector map set array pair tuple optional variant unique_ptr shared_ptr weak_ptr int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t',
    ),
  },
  go: {
    ...SLASHES,
    multi: ['`'],
    strings: ['"', "'"],
    keywords: words(
      'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
    ),
    constants: words('true false nil iota'),
    storage: words(
      'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 bool byte rune string error any',
    ),
  },
  rust: {
    ...SLASHES,
    strings: ['"'],
    lifetimes: true,
    keywords: words(
      'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while',
    ),
    constants: words('true false None Some Ok Err'),
    storage: words(
      'i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box',
    ),
  },
  php: {
    lineComments: ['//', '#'],
    block: ['/*', '*/'],
    strings: ['"', "'", '`'],
    sigils: '$',
    tags: /^(?:<\?php|<\?=|<\?|\?>)/,
    keywords: words(
      'abstract and as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield',
    ),
    constants: words('true false null TRUE FALSE NULL'),
    storage: words('int float string bool array object mixed void iterable self parent'),
  },
  ruby: {
    lineComments: ['#'],
    lineBlock: ['=begin', '=end'],
    strings: ['"', "'", '`'],
    sigils: '$@',
    symbols: true,
    keywords: words(
      'alias and begin break case class def defined? do else elsif end ensure for if in module next not or redo rescue retry return self super then undef unless until when while yield require require_relative include extend attr_accessor attr_reader attr_writer private protected public lambda proc puts',
    ),
    constants: words('true false nil'),
    storage: words('self'),
  },
  shell: {
    lineComments: ['#'],
    strings: ['"', "'", '`'],
    sigils: '$',
    keywords: words(
      'if then else elif fi for while until do done case esac in function select return exit break continue local export readonly declare typeset unset shift source alias trap eval exec set',
    ),
    constants: words('true false'),
    storage: words(
      'echo printf cd ls cat grep sed awk find test read mkdir rm cp mv chmod chown curl wget tar git',
    ),
  },
  powershell: {
    lineComments: ['#'],
    block: ['<#', '#>'],
    multi: ['@"', "@'"],
    multiClose: { '@"': '"@', "@'": "'@" },
    strings: ['"', "'"],
    sigils: '$',
    cmdlets: true,
    keywords: words(
      'begin break catch class continue data do dynamicparam else elseif end enum exit filter finally for foreach from function if in param process return switch throw trap try until using var while workflow',
    ),
    constants: words('$true $false $null'),
    storage: words('int string bool double array hashtable object'),
  },
};

const intern = interner();
const state = (open) => intern(`${open}`, () => ({ open }));
const START = state('');

/** Where the construct `open` ends in `line` from `from` (just after the closing), or -1. */
function closing(line, from, open, def) {
  const close = open === 'block' ? def.block[1] : (def.multiClose?.[open] ?? open);
  for (let i = from; i < line.length; i++) {
    if (open !== 'block' && !def.multiClose && line[i] === '\\' && open !== '`') i++;
    else if (line.startsWith(close, i)) return i + close.length;
  }
  return -1;
}

/** A highlighter for one language of `DEFINITIONS`. */
export function codeHighlighter(def) {
  const scan = (line, from, collect = true) => {
    const { segments, push } = collector(collect);
    let i = 0;
    let open = from.open;
    if (def.lineBlock) {
      if (open === 'line-block') {
        push('comment', line);
        return { segments, state: line.startsWith(def.lineBlock[1]) ? START : from };
      }
      if (line.startsWith(def.lineBlock[0])) {
        push('comment', line);
        return { segments, state: line.startsWith(def.lineBlock[1]) ? START : state('line-block') };
      }
    }
    if (def.preprocessor && !open) {
      // A directive (`#include <stdio.h>`, `#define X 1`): the directive is coloured, the rest of
      // the line goes on as code.
      const directive = /^(\s*)(#\s*\w+)(\s*)(<[^>\n]*>)?/.exec(line);
      if (directive) {
        push(null, directive[1]);
        push('atrule', directive[2]);
        push(null, directive[3]);
        if (directive[4]) push('string', directive[4]);
        i = directive[0].length;
      }
    }
    while (i < line.length) {
      if (open) {
        const end = closing(line, i, open, def);
        if (end < 0) {
          push(open === 'block' ? 'comment' : 'string', line.slice(i));
          return { segments, state: state(open) };
        }
        push(open === 'block' ? 'comment' : 'string', line.slice(i, end));
        i = end;
        open = '';
        continue;
      }
      const ch = line[i];
      const rest = line.slice(i);
      if (/\s/.test(ch)) {
        let j = i + 1;
        while (j < line.length && /\s/.test(line[j])) j++;
        push(null, line.slice(i, j));
        i = j;
      } else if (def.block && line.startsWith(def.block[0], i)) {
        push('comment', def.block[0]);
        i += def.block[0].length;
        open = 'block';
      } else if (def.lineComments?.some((c) => line.startsWith(c, i))) {
        push('comment', rest);
        return { segments, state: START };
      } else if (def.tags?.test(rest)) {
        const tag = def.tags.exec(rest)[0];
        push('storage', tag);
        i += tag.length;
      } else if (def.multi?.some((m) => line.startsWith(m, i))) {
        const delim = def.multi.find((m) => line.startsWith(m, i));
        push('string', delim);
        i += delim.length;
        open = delim;
      } else if (def.lifetimes && ch === "'") {
        const char = /^'(?:\\.[^']*|[^'\\])'/.exec(rest);
        const life = /^'[A-Za-z_]\w*/.exec(rest);
        const found = char ?? life;
        push(char ? 'string' : 'storage', found ? found[0] : ch);
        i += found ? found[0].length : 1;
      } else if (def.strings?.includes(ch)) {
        let j = i + 1;
        while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
        const end = Math.min(line.length, j + 1);
        push('string', line.slice(i, end));
        i = end;
      } else if (
        def.sigils?.includes(ch) &&
        /^[$@]{1,2}(?:\{[^}]*\}?|[A-Za-z_]\w*|[0-9#?@*!$-])/.test(rest)
      ) {
        const found = /^[$@]{1,2}(?:\{[^}]*\}?|[A-Za-z_]\w*|[0-9#?@*!$-])/.exec(rest)[0];
        push(def.constants?.has(found) ? 'constant' : 'identifier', found);
        i += found.length;
      } else if (
        def.symbols &&
        ch === ':' &&
        /^:[A-Za-z_]\w*[?!]?/.test(rest) &&
        line[i - 1] !== ':'
      ) {
        const found = /^:[A-Za-z_]\w*[?!]?/.exec(rest)[0];
        push('constant', found);
        i += found.length;
      } else if (def.cmdlets && /^-[A-Za-z]\w*/.test(rest) && /\s|^$/.test(line[i - 1] ?? ' ')) {
        const found = /^-[A-Za-z]\w*/.exec(rest)[0];
        push('key', found);
        i += found.length;
      } else if (/\d/.test(ch) || (ch === '.' && /\d/.test(line[i + 1] ?? ''))) {
        const found = NUMBER.exec(rest)[0];
        push('number', found);
        i += found.length;
      } else if (/[A-Za-z_]/.test(ch)) {
        const pattern = def.cmdlets ? /^[A-Za-z_]\w*(?:-[A-Za-z]\w*)*[?!]?/ : /^[A-Za-z_]\w*[?!]?/;
        const word = pattern.exec(rest)[0];
        const bare = word.replace(/[?!]$/, '');
        const j = i + word.length;
        const call = /^\s*\(/.test(line.slice(j));
        const verb = def.cmdlets && /^[A-Z][a-z]+-[A-Z]\w+$/.test(word);
        push(
          def.keywords.has(word) || def.keywords.has(bare)
            ? 'keyword'
            : def.constants.has(word)
              ? 'constant'
              : def.storage.has(word)
                ? 'storage'
                : verb || call
                  ? 'function'
                  : null,
          word,
        );
        i = j;
      } else if (/[{}()[\];,.:=<>+\-*/%|&^~!?@]/.test(ch)) {
        push('punct', ch);
        i++;
      } else {
        push(null, ch);
        i++;
      }
    }
    return { segments, state: open ? state(open) : START };
  };
  return highlighterFor(START, scan);
}

export const PythonHighlighter = codeHighlighter(DEFINITIONS.python);
export const JavaHighlighter = codeHighlighter(DEFINITIONS.java);
export const CSharpHighlighter = codeHighlighter(DEFINITIONS.csharp);
export const CHighlighter = codeHighlighter(DEFINITIONS.c);
export const CppHighlighter = codeHighlighter(DEFINITIONS.cpp);
export const GoHighlighter = codeHighlighter(DEFINITIONS.go);
export const RustHighlighter = codeHighlighter(DEFINITIONS.rust);
export const PhpHighlighter = codeHighlighter(DEFINITIONS.php);
export const RubyHighlighter = codeHighlighter(DEFINITIONS.ruby);
export const ShellHighlighter = codeHighlighter(DEFINITIONS.shell);
export const PowerShellHighlighter = codeHighlighter(DEFINITIONS.powershell);
