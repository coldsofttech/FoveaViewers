import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { themeVars, useLatest } from '@coldsofttech/fovea-viewers/core';
import { Line } from './Line.jsx';
import { useLines } from './useLines.js';
import styles from './TextViewer.module.css';

/** Extra lines drawn above and below the view, so scrolling never shows a gap. */
const OVERSCAN = 20;
/** The view height assumed until the browser has measured the real one, in pixels. */
const FALLBACK_HEIGHT = 600;

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 */

/**
 * @typedef {object} TextViewerProps
 * @property {ViewerSource} source The text file: a URL, a Blob or File, or an ArrayBuffer (UTF-8).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication
 *   and transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Text`.
 * @property {{ line: number, column?: number | null, length?: number }} [target] A line (from 1)
 *   to scroll to, and optionally the characters on it to mark (`column` from 1). Changing it
 *   scrolls again.
 * @property {number} [lineHeight] The height of every line in pixels. Defaults to 20.
 * @property {(info: { lineCount: number }) => void} [onReady] Called when the text is shown.
 * @property {(error: Error) => void} [onError] Called when the text cannot be loaded.
 */

/**
 * A read-only view of a text file with line numbers. Only the lines in view are in the page, so
 * a file of hundreds of thousands of lines opens at once. Lines do not wrap; a long one scrolls
 * sideways.
 *
 * @param {TextViewerProps} props
 */
export function TextViewer({
  source,
  fetcher,
  theme,
  label = 'Text',
  target,
  lineHeight = 20,
  onReady,
  onError,
}) {
  const { status, lines, error } = useLines(source, fetcher);
  const root = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [view, setView] = useState({ top: 0, height: 0 });
  const total = lines ? lines.length : 0;
  const digits = String(Math.max(1, total)).length;

  const measure = useCallback(() => {
    const element = root.current;
    if (element) setView({ top: element.scrollTop, height: element.clientHeight });
  }, []);

  useLayoutEffect(() => {
    measure();
    const element = root.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  useEffect(() => {
    if (lines) ready.current?.({ lineCount: lines.length });
  }, [lines, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  const height = view.height || FALLBACK_HEIGHT;
  const first = Math.max(0, Math.floor(view.top / lineHeight) - OVERSCAN);
  const last = Math.min(total - 1, Math.ceil((view.top + height) / lineHeight) + OVERSCAN);

  // Scroll so the target line is in the middle of the view.
  const scrolled = useRef(/** @type {{ key: string, lines: string[] } | null} */ (null));
  useLayoutEffect(() => {
    const element = root.current;
    if (!target || !lines || !element || !view.height) return;
    const key = `${target.line}:${target.column ?? ''}`;
    if (scrolled.current && scrolled.current.key === key && scrolled.current.lines === lines) {
      return;
    }
    scrolled.current = { key, lines };
    element.scrollTop = Math.max(
      0,
      (target.line - 1) * lineHeight - (view.height - lineHeight) / 2,
    );
    measure();
  }, [target, lines, view.height, lineHeight, measure]);

  // Once the target's line is drawn, bring its marked characters into view sideways too.
  const sideways = useRef(/** @type {string | null} */ (null));
  useLayoutEffect(() => {
    const element = root.current;
    if (!target || !element) return;
    const key = `${target.line}:${target.column ?? ''}:${target.length ?? ''}`;
    if (sideways.current === key) return;
    const mark = element.querySelector('mark');
    if (!mark) return;
    sideways.current = key;
    const box = element.getBoundingClientRect();
    const at = mark.getBoundingClientRect();
    if (at.right > box.right - 24 || at.left < box.left + 80) {
      element.scrollLeft += at.left - box.left - box.width / 3;
    }
  }, [target, lines, view]);

  const rows = useMemo(() => {
    if (!lines) return null;
    const out = [];
    for (let index = first; index <= last; index++) {
      const text = lines.at(index) ?? '';
      const number = index + 1;
      const here = Boolean(target) && target?.line === number;
      const from = here && target?.column ? target.column - 1 : null;
      const mark =
        from !== null && target?.length
          ? { from: Math.min(from, text.length), to: Math.min(text.length, from + target.length) }
          : null;
      out.push(
        <Line
          key={number}
          number={number}
          text={text}
          mark={mark}
          current={here}
          top={index * lineHeight}
          height={lineHeight}
          digits={digits}
        />,
      );
    }
    return out;
  }, [lines, first, last, target, lineHeight, digits]);

  return (
    <div
      ref={root}
      role="region"
      aria-label={label}
      aria-busy={status === 'loading'}
      className={styles.root}
      style={themeVars(theme)}
      onScroll={measure}
      // A scrollable region must take focus so the keyboard can scroll it.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      {status === 'loading' && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className={styles.message}>
          The text could not be loaded: {error?.message}
        </p>
      )}
      {lines && (
        <div className={styles.content} style={{ height: total * lineHeight }}>
          {rows}
        </div>
      )}
    </div>
  );
}
