import {
  CHighlighter,
  CSharpHighlighter,
  CppHighlighter,
  GoHighlighter,
  JavaHighlighter,
  PhpHighlighter,
  PowerShellHighlighter,
  PythonHighlighter,
  RubyHighlighter,
  RustHighlighter,
  ShellHighlighter,
} from './highlighters/code.js';
import { CssHighlighter, formatCss } from './highlighters/css.js';
import { IniHighlighter } from './highlighters/ini.js';
import { JsHighlighter, formatJs } from './highlighters/js.js';
import { JsonHighlighter, formatJson } from './highlighters/json.js';
import { LogHighlighter } from './highlighters/log.js';
import { RstHighlighter } from './highlighters/rst.js';
import { SqlHighlighter } from './highlighters/sql.js';
import { TomlHighlighter } from './highlighters/toml.js';
import { XmlHighlighter, formatXml } from './highlighters/xml.js';
import { YamlHighlighter } from './highlighters/yaml.js';

/**
 * The key a match's value sits under, for a file flattened to `path: value` lines
 * (`server.ports[0]: 8080`, `catalog/book@id: 7`): the last name of the path, so the value can be
 * found under it. Nothing when the match is not a value.
 *
 * @param {string | undefined} before The text before the match.
 * @returns {string | null}
 */
export function keyBefore(before) {
  // Read back from the end by hand: a pattern for this backtracks badly on a long line with no colon.
  const text = (before ?? '').trimEnd();
  if (!text.endsWith(':')) return null;
  let start = text.length - 1;
  while (start > 0 && !/\s/.test(text.charAt(start - 1))) start--;
  const path = text.slice(start, -1);
  if (!path) return null;
  const names = path.split(/[./@[\]]+/).filter((part) => part && !/^\d+$/.test(part));
  return names.at(-1) ?? null;
}

/** @param {string | undefined} before */
const jsonKey = (before) => {
  const key = keyBefore(before);
  return key ? `"${key}"` : null;
};
const none = () => null;

/**
 * @typedef {object} LanguageSpec
 * @property {string} label The name shown to people.
 * @property {new (lines: string[]) => { segments(index: number): Array<[string | null, string]> | null }} [Highlighter]
 *   Colours the lines of a file (none: the text is shown plain).
 * @property {((text: string) => string) | null} format Lays out a minified file (none: it is
 *   readable as written).
 * @property {(before: string | undefined) => string | null} hint The key a match sits under.
 * @property {string[]} extensions File extensions, lowercase and without the dot.
 */

/**
 * What the code viewer knows of each language: its name, how to colour it, how to lay out a
 * minified file, how to find a match in it, and which file extensions are it.
 *
 * @type {Record<string, LanguageSpec>}
 */
export const LANGUAGES = {
  css: {
    label: 'CSS',
    Highlighter: CssHighlighter,
    format: formatCss,
    hint: none,
    extensions: ['css'],
  },
  js: {
    label: 'JavaScript',
    Highlighter: JsHighlighter,
    format: formatJs,
    hint: none,
    extensions: ['js', 'mjs', 'cjs'],
  },
  ts: {
    label: 'TypeScript',
    Highlighter: JsHighlighter,
    format: null,
    hint: none,
    extensions: ['ts', 'mts', 'cts'],
  },
  tsx: { label: 'TSX', Highlighter: JsHighlighter, format: null, hint: none, extensions: ['tsx'] },
  jsx: { label: 'JSX', Highlighter: JsHighlighter, format: null, hint: none, extensions: ['jsx'] },
  json: {
    label: 'JSON',
    Highlighter: JsonHighlighter,
    format: formatJson,
    hint: jsonKey,
    extensions: ['json', 'jsonc', 'geojson'],
  },
  // One JSON value to a line, so the JSON colouring (which takes a line on its own) fits. There is
  // no layout, because a minified line is a record and the file is readable as it is.
  ndjson: {
    label: 'NDJSON',
    Highlighter: JsonHighlighter,
    format: null,
    hint: jsonKey,
    extensions: ['ndjson', 'jsonl'],
  },
  // A notebook is JSON, already laid out.
  ipynb: {
    label: 'Notebook',
    Highlighter: JsonHighlighter,
    format: null,
    hint: none,
    extensions: ['ipynb'],
  },
  yaml: {
    label: 'YAML',
    Highlighter: YamlHighlighter,
    format: null,
    hint: keyBefore,
    extensions: ['yaml', 'yml'],
  },
  toml: {
    label: 'TOML',
    Highlighter: TomlHighlighter,
    format: null,
    hint: keyBefore,
    extensions: ['toml'],
  },
  ini: {
    label: 'INI',
    Highlighter: IniHighlighter,
    format: null,
    hint: keyBefore,
    extensions: ['ini', 'cfg'],
  },
  xml: {
    label: 'XML',
    Highlighter: XmlHighlighter,
    format: formatXml,
    hint: keyBefore,
    extensions: ['xml', 'xsd', 'xsl', 'xslt', 'plist'],
  },
  sql: { label: 'SQL', Highlighter: SqlHighlighter, format: null, hint: none, extensions: ['sql'] },
  rst: {
    label: 'reStructuredText',
    Highlighter: RstHighlighter,
    format: null,
    hint: none,
    extensions: ['rst'],
  },
  log: { label: 'Log', Highlighter: LogHighlighter, format: null, hint: none, extensions: ['log'] },
  c: { label: 'C', Highlighter: CHighlighter, format: null, hint: none, extensions: ['c', 'h'] },
  cpp: {
    label: 'C++',
    Highlighter: CppHighlighter,
    format: null,
    hint: none,
    extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'],
  },
  cs: { label: 'C#', Highlighter: CSharpHighlighter, format: null, hint: none, extensions: ['cs'] },
  java: {
    label: 'Java',
    Highlighter: JavaHighlighter,
    format: null,
    hint: none,
    extensions: ['java'],
  },
  go: { label: 'Go', Highlighter: GoHighlighter, format: null, hint: none, extensions: ['go'] },
  rs: { label: 'Rust', Highlighter: RustHighlighter, format: null, hint: none, extensions: ['rs'] },
  py: {
    label: 'Python',
    Highlighter: PythonHighlighter,
    format: null,
    hint: none,
    extensions: ['py', 'pyw'],
  },
  php: { label: 'PHP', Highlighter: PhpHighlighter, format: null, hint: none, extensions: ['php'] },
  rb: { label: 'Ruby', Highlighter: RubyHighlighter, format: null, hint: none, extensions: ['rb'] },
  sh: {
    label: 'Shell',
    Highlighter: ShellHighlighter,
    format: null,
    hint: none,
    extensions: ['sh', 'bash', 'zsh'],
  },
  ps1: {
    label: 'PowerShell',
    Highlighter: PowerShellHighlighter,
    format: null,
    hint: none,
    extensions: ['ps1', 'psm1'],
  },
};

/**
 * The spec of a language, by its key. Only the languages listed above are found: a key such as
 * `constructor` is not one.
 *
 * @param {string | null | undefined} id
 * @returns {LanguageSpec | undefined}
 */
export function languageSpec(id) {
  // eslint-disable-next-line security/detect-object-injection -- `id` is checked to be an own key
  return id && Object.hasOwn(LANGUAGES, id) ? LANGUAGES[id] : undefined;
}

/** Shown for a file whose language is not known: plain text. */
export const PLAIN = { label: 'Text', format: null, hint: none, extensions: [] };

/**
 * The language of a file, from the extension of its name or URL.
 *
 * @param {unknown} source A File (its name), a URL or file name, or anything else (no language).
 * @returns {string | null} A key of `LANGUAGES`, or `null` when it is not known.
 */
export function languageOf(source) {
  const name = typeof source === 'string' ? source : source instanceof File ? source.name : '';
  const path = name.split(/[?#]/)[0];
  const dot = path.lastIndexOf('.');
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (dot <= slash) return null;
  const extension = path.slice(dot + 1).toLowerCase();
  for (const [id, spec] of Object.entries(LANGUAGES)) {
    if (spec.extensions.includes(extension)) return id;
  }
  return null;
}
