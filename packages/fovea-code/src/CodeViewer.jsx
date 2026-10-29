import { useCallback, useEffect, useMemo } from 'react';
import { useLatest, useText } from '@coldsofttech/fovea-viewers/core';
import { LineViewer } from '@coldsofttech/fovea-text';
import { locateWords } from './highlighters/locate.js';
import { PLAIN, languageOf, languageSpec } from './languages.js';
import { codeTheme } from './themes.js';

// A file bigger than this is not laid out (that would be a lot of text to make): its source is shown.
const FORMAT_LIMIT = 20 * 1024 * 1024;
// A line longer than this is not drawn in full (nor coloured): a minified file is one such line.
const LONG_LINE = 20000;
// A file with a line this long is shown laid out (when its language can be) until told otherwise.
const MINIFIED = 2000;

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 * @typedef {{ line: number, column: number, offset: number, end: number }} Located
 */

/**
 * How a file is shown: `source` as it is, or `formatted` (laid out, for a minified file). The
 * choice is the person's (`null` until they make one); without it a file with a very long line
 * opens laid out, when its language has a layout.
 *
 * @param {string} language A key of `LANGUAGES`.
 * @param {string | null} text The file's text (null while it is being read).
 * @param {number} longestLine The length of its longest line.
 * @param {'source' | 'formatted' | null} choice
 * @returns {{ mode: 'source' | 'formatted', canFormat: boolean, tooBig: boolean }}
 */
export function codeMode(language, text, longestLine, choice) {
  const tooBig = text !== null && text.length > FORMAT_LIMIT;
  const canFormat = Boolean(languageSpec(language)?.format) && !tooBig;
  const mode = !canFormat
    ? 'source'
    : (choice ?? (longestLine > MINIFIED ? 'formatted' : 'source'));
  return { mode, canFormat, tooBig };
}

/**
 * @typedef {object} CodeViewerProps
 * @property {ViewerSource} source The file: a URL, a Blob or File, or an ArrayBuffer (UTF-8).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication
 *   and transport. Defaults to `fetch`.
 * @property {string} [language] A key of `LANGUAGES` (`js`, `json`, `py`...). Worked out from the
 *   file name or URL when left out; a file whose language is not known is shown plain.
 * @property {'auto' | 'source' | 'formatted'} [mode] `source` shows the text as it is and
 *   `formatted` lays it out, for a minified file. `auto` (the default) lays out a file with a
 *   very long line, when its language can be laid out.
 * @property {{ before?: string, matched?: string, after?: string } | null} [match] Words to find
 *   in the text shown and mark on their line.
 * @property {ViewerTheme} [theme] `light`, `dark` (VS Code's Light+ and Dark+) or your own colours.
 *   Defaults to `light`.
 * @property {string} [label] The accessible name. Defaults to the language and `source`.
 * @property {number} [lineHeight] The height of every line in pixels. Defaults to 20.
 * @property {(where: Located | null) => void} [onLocated] Called with where the match is in the
 *   text shown (lines from 1), or `null` when it is not there.
 * @property {(info: { lineCount: number, language: string | null, mode: 'source' | 'formatted', canFormat: boolean, tooBig: boolean }) => void} [onReady]
 *   Called when the code is shown.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded.
 */

/**
 * A read-only view of a source file as Visual Studio Code would show it: line numbers and the
 * colours of its Light+ or Dark+ theme, with only the lines in view in the page. A match can be
 * found in the text shown (and under its key, for a file of `key: value` lines) and marked.
 *
 * @param {CodeViewerProps} props
 */
export function CodeViewer({
  source,
  fetcher,
  language,
  mode = 'auto',
  match = null,
  theme,
  label,
  lineHeight,
  onLocated,
  onReady,
  onError,
}) {
  const { status, text, error } = useText(source, fetcher);
  const id = language ?? languageOf(source);
  const spec = languageSpec(id) ?? PLAIN;

  // Line breaks are made `\n`, so line numbers and offsets agree with how a match is found.
  const plain = useMemo(() => (text === null ? null : text.replace(/\r\n?/g, '\n')), [text]);
  const longestLine = useMemo(() => {
    let longest = 0;
    let from = 0;
    if (plain === null) return 0;
    for (let at = plain.indexOf('\n'); ; at = plain.indexOf('\n', from)) {
      const end = at === -1 ? plain.length : at;
      longest = Math.max(longest, end - from);
      if (at === -1) break;
      from = at + 1;
    }
    return longest;
  }, [plain]);

  const how = codeMode(id ?? '', plain, longestLine, mode === 'auto' ? null : mode);
  const shown = useMemo(
    () => (plain !== null && how.mode === 'formatted' && spec.format ? spec.format(plain) : plain),
    [plain, how.mode, spec],
  );
  const rawLines = useMemo(() => (shown === null ? null : shown.split('\n')), [shown]);
  const lines = useMemo(
    () =>
      rawLines === null
        ? null
        : rawLines.map((l) => (l.length > LONG_LINE ? `${l.slice(0, LONG_LINE)}…` : l)),
    [rawLines],
  );
  const highlighter = useMemo(
    () =>
      rawLines && 'Highlighter' in spec && spec.Highlighter ? new spec.Highlighter(rawLines) : null,
    [rawLines, spec],
  );
  const tokens = useCallback(
    (/** @type {string} */ _text, /** @type {number} */ index) =>
      highlighter &&
      rawLines &&
      rawLines.at(index) !== undefined &&
      (rawLines.at(index) ?? '').length <= LONG_LINE
        ? highlighter.segments(index)
        : null,
    [highlighter, rawLines],
  );

  const before = match?.before;
  const matched = match?.matched;
  const after = match?.after;
  const where = useMemo(
    () =>
      shown === null || matched === undefined || matched === null
        ? null
        : locateWords(shown, { before, matched, after, hint: spec.hint(before) ?? undefined }),
    [shown, before, matched, after, spec],
  );
  const located = useLatest(onLocated);
  useEffect(() => {
    if (shown !== null) located.current?.(where);
  }, [where, shown, located]);

  const target = useMemo(
    () =>
      where
        ? { line: where.line, column: where.column, length: where.end - where.offset }
        : undefined,
    [where],
  );

  const ready = useLatest(onReady);
  const { mode: shownMode, canFormat, tooBig } = how;
  useEffect(() => {
    if (lines) {
      ready.current?.({
        lineCount: lines.length,
        language: id ?? null,
        mode: shownMode,
        canFormat,
        tooBig,
      });
    }
  }, [lines, id, shownMode, canFormat, tooBig, ready]);

  return (
    <LineViewer
      key={`${id}:${shownMode}`}
      lines={lines}
      status={lines ? 'ready' : status}
      error={error}
      tokens={tokens}
      theme={codeTheme(theme)}
      target={target}
      lineHeight={lineHeight}
      label={label ?? `${spec.label} source`}
      onError={onError}
    />
  );
}
