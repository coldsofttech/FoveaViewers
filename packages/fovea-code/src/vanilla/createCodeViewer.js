import { applyTheme, createShell, loadText } from '@coldsofttech/fovea-viewers/core/vanilla';
import { createLineViewer } from '@coldsofttech/fovea-text/vanilla';
import { LONG_LINE, codeMode } from '../codeMode.js';
import { locateWords } from '../highlighters/locate.js';
import { PLAIN, languageOf, languageSpec } from '../languages.js';
import { codeTheme } from '../themes.js';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {{ line: number, column: number, offset: number, end: number }} Located
 */

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
 * A read-only view of a source file as Visual Studio Code would show it, drawn into a container:
 * line numbers and the colours of its Light+ or Dark+ theme, with only the lines in view in the
 * page. A match can be found in the text shown (and under its key, for a file of `key: value`
 * lines) and marked. Style it with `@coldsofttech/fovea-text/style.css`, as the text viewer.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {CodeViewerProps} props
 * @returns {ViewerController}
 */
export function createCodeViewer(container, props) {
  const shell = createShell(container, props);
  const { root } = shell;
  // The text viewer inside is the viewer; this element only holds it.
  root.style.height = '100%';

  /** @type {'loading' | 'ready' | 'error'} */
  let status = 'loading';
  /** @type {string | null} */
  let text = null;
  /** @type {Error | null} */
  let error = null;

  // What is worked out from the text, kept until what it depends on changes.
  /** @type {{ text: string | null, plain: string | null, longest: number } | null} */
  let plainCache = null;
  /** @type {{ plain: string | null, mode: string, spec: object, shown: string | null, rawLines: string[] | null, lines: string[] | null, highlighter: any } | null} */
  let shownCache = null;
  /** @type {{ shown: string | null, before?: string, matched?: string | null, after?: string, spec: object, where: Located | null } | null} */
  let whereCache = null;
  /** @type {string[] | null} */
  let reportedLines = null;
  /** @type {Located | null | undefined} */
  let reportedWhere;
  let reportedShown = false;
  /** @type {ViewerController | null} */
  let inner = null;
  let innerKey = '';
  /** @type {((text: string, index: number) => any) | undefined} */
  let tokens;

  function state() {
    const { source, language, mode = 'auto', match } = shell.props;
    const id = language ?? languageOf(source);
    const spec = languageSpec(id) ?? PLAIN;

    // Line breaks are made `\n`, so line numbers and offsets agree with how a match is found.
    if (plainCache?.text !== text) {
      const plain = text === null ? null : text.replace(/\r\n?/g, '\n');
      let longest = 0;
      if (plain !== null) {
        let from = 0;
        for (let at = plain.indexOf('\n'); ; at = plain.indexOf('\n', from)) {
          const end = at === -1 ? plain.length : at;
          longest = Math.max(longest, end - from);
          if (at === -1) break;
          from = at + 1;
        }
      }
      plainCache = { text, plain, longest };
    }
    const { plain, longest } = plainCache;

    const how = codeMode(id ?? '', plain, longest, mode === 'auto' ? null : mode);
    if (!(
      shownCache &&
      shownCache.plain === plain &&
      shownCache.mode === how.mode &&
      shownCache.spec === spec
    )) {
      const shown =
        plain !== null && how.mode === 'formatted' && spec.format ? spec.format(plain) : plain;
      const rawLines = shown === null ? null : shown.split('\n');
      const lines =
        rawLines === null
          ? null
          : rawLines.map((l) => (l.length > LONG_LINE ? `${l.slice(0, LONG_LINE)}…` : l));
      const highlighter =
        rawLines && 'Highlighter' in spec && spec.Highlighter
          ? new spec.Highlighter(rawLines)
          : null;
      shownCache = { plain, mode: how.mode, spec, shown, rawLines, lines, highlighter };
      tokens = (_text, index) => {
        const raw = rawLines?.at(index);
        return highlighter && raw !== undefined && raw.length <= LONG_LINE
          ? highlighter.segments(index)
          : null;
      };
    }
    const { shown, lines } = shownCache;

    const before = match?.before;
    const matched = match?.matched;
    const after = match?.after;
    if (!(
      whereCache &&
      whereCache.shown === shown &&
      whereCache.before === before &&
      whereCache.matched === matched &&
      whereCache.after === after &&
      whereCache.spec === spec
    )) {
      const where =
        shown === null || matched === undefined || matched === null
          ? null
          : locateWords(shown, { before, matched, after, hint: spec.hint(before) ?? undefined });
      whereCache = { shown, before, matched, after, spec, where };
    }
    return { id, spec, how, shown, lines, where: whereCache.where };
  }

  function render() {
    const { id, spec, how, shown, lines, where } = state();
    const target = where
      ? { line: where.line, column: where.column, length: where.end - where.offset }
      : undefined;
    const lineProps = {
      lines,
      status: lines ? 'ready' : status,
      error,
      tokens,
      theme: codeTheme(shell.props.theme),
      target,
      lineHeight: shell.props.lineHeight,
      label: shell.props.label ?? `${spec.label} source`,
    };
    // A new language or layout starts the text viewer again, back at the top.
    const key = `${id}:${how.mode}`;
    if (inner && key !== innerKey) {
      inner.destroy();
      inner = null;
    }
    if (inner) {
      inner.update(lineProps);
    } else {
      innerKey = key;
      inner = createLineViewer(root, {
        ...lineProps,
        onError: (/** @type {Error} */ failure) => shell.emit('onError', failure),
      });
    }

    if (shown !== null && (where !== reportedWhere || !reportedShown)) {
      shell.emit('onLocated', where);
    }
    reportedWhere = where;
    reportedShown = shown !== null;
    if (lines && lines !== reportedLines) {
      shell.emit('onReady', {
        lineCount: lines.length,
        language: id ?? null,
        mode: how.mode,
        canFormat: how.canFormat,
        tooBig: how.tooBig,
      });
    }
    reportedLines = lines;
  }

  function reload() {
    status = 'loading';
    text = null;
    error = null;
    render();
    shell.load((signal) => loadText(shell.props.source, { fetcher: shell.props.fetcher, signal }), {
      onResult(loaded) {
        status = 'ready';
        text = loaded;
        render();
      },
      onError(failure) {
        status = 'error';
        error = failure;
        render();
      },
    });
  }

  shell.cleanup(() => inner?.destroy());
  applyTheme(root, codeTheme(props.theme));
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, codeTheme(current.theme));
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else render();
  });
  return shell.api;
}
