/* eslint-disable security/detect-object-injection -- the keys are line indexes counted from the array's own length. */
import { applyTheme } from '@coldsofttech/fovea-viewers/core/vanilla';
import { piecesOf } from '../pieces.js';
import styles from '../TextViewer.module.css';

/** Extra lines drawn above and below the view, so scrolling never shows a gap. */
const OVERSCAN = 20;
/** The view height assumed until the browser has measured the real one, in pixels. */
const FALLBACK_HEIGHT = 600;

/**
 * @typedef {import('./createLineViewer.js').LineViewerProps} LineViewerProps
 */

/**
 * The part of a line viewer that draws lines: the controllers of both `LineViewer` and `TextViewer`
 * build on it. It draws into `root`, which the caller owns, and only the lines in view are in the
 * page.
 *
 * @param {object} options
 * @param {HTMLElement} options.root The viewer's root element.
 * @param {ReturnType<typeof import('@coldsofttech/fovea-viewers/core/vanilla').createH>} options.h
 * @param {(name: 'onReady' | 'onError', ...args: any[]) => void} options.emit
 * @returns {{ set: (next: Partial<LineViewerProps>) => void, destroy: () => void }}
 */
export function createLineView({ root, h, emit }) {
  /** @type {LineViewerProps} */
  let state = { lines: null, status: 'ready', error: null, label: 'Text', lineHeight: 20 };
  let view = { top: 0, height: 0 };
  /** @type {HTMLElement | null} */
  let message = null;
  /** @type {HTMLElement | null} */
  let content = null;
  /** @type {Map<number, HTMLElement>} The drawn lines, by index. */
  const rows = new Map();
  /** @type {string[] | null | undefined} */
  let reported = null;
  /** @type {Error | null | undefined} */
  let failed = null;
  /** @type {{ key: string, lines: string[] } | null} */
  let scrolled = null;
  /** @type {string | null} */
  let sideways = null;

  root.setAttribute('role', 'region');
  // A scrollable region must take focus so the keyboard can scroll it.
  root.setAttribute('tabindex', '0');
  root.addEventListener('scroll', () => measure());

  const lineHeight = () => state.lineHeight ?? 20;
  const total = () => (state.lines ? state.lines.length : 0);

  /** @param {number} index */
  function buildRow(index) {
    const { tokens, target } = state;
    const text = state.lines?.at(index) ?? '';
    const number = index + 1;
    const height = lineHeight();
    const here = Boolean(target) && target?.line === number;
    const from = here && target?.column ? target.column - 1 : null;
    const mark =
      from !== null && target?.length
        ? { from: Math.min(from, text.length), to: Math.min(text.length, from + target.length) }
        : null;
    const segments = tokens ? tokens(text, index) : null;

    const digits = String(Math.max(1, total())).length;
    const gutter = h('span', { class: styles.gutter, 'aria-hidden': 'true' }, number);
    gutter.style.width = `${digits + 2}ch`;
    const body = h('span', { class: styles.text });
    if (segments || mark) {
      for (const piece of piecesOf(text, segments, mark)) {
        const part = h(
          piece.hit ? 'mark' : 'span',
          piece.hit ? { class: styles.hit } : null,
          piece.text,
        );
        if (piece.kind) part.style.color = `var(--fovea-token-${piece.kind}, inherit)`;
        body.append(part);
      }
    } else {
      body.append(text);
    }
    const row = h(
      'div',
      { class: here ? `${styles.line} ${styles.current}` : styles.line, 'data-line': number },
      gutter,
      body,
    );
    row.style.top = `${index * height}px`;
    row.style.height = `${height}px`;
    row.style.lineHeight = `${height}px`;
    return row;
  }

  /** Draws the lines in view, adding and dropping only what changed unless `rebuild`. */
  function draw(rebuild = false) {
    if (!content) return;
    const height = lineHeight();
    content.style.height = `${total() * height}px`;
    const room = view.height || FALLBACK_HEIGHT;
    const first = Math.max(0, Math.floor(view.top / height) - OVERSCAN);
    const last = Math.min(total() - 1, Math.ceil((view.top + room) / height) + OVERSCAN);

    if (rebuild) {
      content.replaceChildren();
      rows.clear();
    }
    for (const [index, row] of rows) {
      if (index < first || index > last) {
        row.remove();
        rows.delete(index);
      }
    }
    const kept = [...rows.keys()];
    const lowest = kept.length ? Math.min(...kept) : first;
    // Lines above the ones already drawn go in front, in order; the rest go after.
    const before = content.firstChild;
    for (let index = first; index <= last; index++) {
      if (rows.has(index)) continue;
      const row = buildRow(index);
      rows.set(index, row);
      if (index < lowest) content.insertBefore(row, before);
      else content.append(row);
    }
  }

  function renderMessage() {
    const { status, error } = state;
    const wanted = status === 'loading' ? 'status' : status === 'error' ? 'alert' : null;
    if (!wanted) {
      message?.remove();
      message = null;
      return;
    }
    if (!message || message.getAttribute('role') !== wanted) {
      message?.remove();
      message = h('p', { role: wanted, class: styles.message });
      root.prepend(message);
    }
    message.textContent =
      status === 'loading' ? 'Loading…' : `The file could not be loaded: ${error?.message ?? ''}`;
  }

  /** Scrolls so the target line is in the middle of the view, once for each target. */
  function scrollToTarget() {
    const { target, lines } = state;
    if (!target || !lines || !view.height) return;
    const key = `${target.line}:${target.column ?? ''}`;
    if (scrolled && scrolled.key === key && scrolled.lines === lines) return;
    scrolled = { key, lines };
    root.scrollTop = Math.max(
      0,
      (target.line - 1) * lineHeight() - (view.height - lineHeight()) / 2,
    );
    measure();
  }

  /** Once the target's line is drawn, brings its marked characters into view sideways too. */
  function scrollAcross() {
    const { target } = state;
    if (!target) return;
    const key = `${target.line}:${target.column ?? ''}:${target.length ?? ''}`;
    if (sideways === key) return;
    const mark = root.querySelector('mark');
    if (!mark) return;
    sideways = key;
    const box = root.getBoundingClientRect();
    const at = mark.getBoundingClientRect();
    if (at.right > box.right - 24 || at.left < box.left + 80) {
      root.scrollLeft += at.left - box.left - box.width / 3;
    }
  }

  function measure() {
    const next = { top: root.scrollTop, height: root.clientHeight };
    if (next.top === view.top && next.height === view.height) return;
    view = next;
    draw();
    scrollToTarget();
    scrollAcross();
  }

  /** @param {Partial<LineViewerProps>} next */
  function set(next) {
    const previous = state;
    state = { ...state, ...next };
    const changed = (/** @type {keyof LineViewerProps} */ name) =>
      !Object.is(previous[name], state[name]);

    if (changed('theme')) applyTheme(root, state.theme);
    if (changed('label')) root.setAttribute('aria-label', state.label ?? 'Text');
    root.setAttribute('aria-busy', String(state.status === 'loading'));
    if (changed('status') || changed('error')) renderMessage();

    const lines = state.lines ?? null;
    if (changed('lines') || !content) {
      if (lines && !content) {
        content = h('div', { class: styles.content });
        root.append(content);
      } else if (!lines && content) {
        content.remove();
        content = null;
        rows.clear();
      }
    }
    if (content) {
      draw(changed('lines') || changed('tokens') || changed('target') || changed('lineHeight'));
    }
    scrollToTarget();
    scrollAcross();

    if (lines && lines !== reported) emit('onReady', { lineCount: lines.length });
    reported = lines;
    if (state.error && state.error !== failed) emit('onError', state.error);
    failed = state.error;
  }

  /** @type {ResizeObserver | undefined} */
  let observer;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure());
    observer.observe(root);
  }
  root.setAttribute('aria-label', state.label ?? 'Text');
  root.setAttribute('aria-busy', 'false');
  measure();

  return {
    set,
    destroy() {
      observer?.disconnect();
    },
  };
}
