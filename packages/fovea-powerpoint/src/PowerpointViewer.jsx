import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearMarks,
  markIn,
  themeVars,
  useLatest,
  useSource,
} from '@coldsofttech/fovea-viewers/core';
import { locate, parsePresentation } from './parsePresentation.js';
import { SlideView } from './SlideView.jsx';
import styles from './PowerpointViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 */

/**
 * @typedef {object} PowerpointViewerProps
 * @property {ViewerSource} source The presentation: a URL, a Blob or File, or an ArrayBuffer
 *   (`.pptx` or `.pptm`; macros are never run).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours around the slides. Defaults
 *   to the page's.
 * @property {string} [label] The accessible name. Defaults to `Presentation`.
 * @property {number} [slide] The slide to show, from 0. When given, the host decides the slide and
 *   `onSlideChange` is how it hears of a choice.
 * @property {(index: number) => void} [onSlideChange] Called when another slide is chosen.
 * @property {boolean} [showNotes] Show the speaker notes under the slide. Defaults to true.
 * @property {boolean} [thumbnails] Show a strip of small slides to choose from. Defaults to true.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to find in the
 *   presentation: the slide that holds them is shown and the words marked.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were marked
 *   (`null`: there is no target).
 * @property {(info: { slideCount: number }) => void} [onReady] Called when the presentation is
 *   shown.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/**
 * A viewer for a PowerPoint presentation: the slide with its text, tables and pictures placed as in
 * the file, buttons and keys to move between slides, small slides to choose from, and speaker
 * notes. Animations, charts, SmartArt and theme colours and fonts are not shown.
 *
 * @param {PowerpointViewerProps} props
 */
export function PowerpointViewer({
  source,
  fetcher,
  theme,
  label = 'Presentation',
  slide,
  onSlideChange,
  showNotes = true,
  thumbnails = true,
  target,
  onMarked,
  onReady,
  onError,
}) {
  const loaded = useSource(source, fetcher);
  const [parsed, setParsed] = useState(
    /** @type {{ blob: Blob, presentation?: import('./parsePresentation.js').Presentation, error?: Error } | null} */ (
      null
    ),
  );
  const [picked, setPicked] = useState(/** @type {{ index: number, key: string } | null} */ (null));
  const area = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  const marked = useLatest(onMarked);
  const changed = useLatest(onSlideChange);

  useEffect(() => {
    const { blob } = loaded;
    if (!blob) return undefined;
    let current = true;
    parsePresentation(blob).then(
      (presentation) => current && setParsed({ blob, presentation }),
      (error) =>
        current &&
        setParsed({ blob, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      current = false;
    };
  }, [loaded]);

  const presentation = parsed?.blob === loaded.blob ? (parsed?.presentation ?? null) : null;
  const error = loaded.error ?? (parsed?.blob === loaded.blob ? (parsed?.error ?? null) : null);
  const slides = presentation?.slides ?? [];

  useEffect(() => {
    if (presentation) ready.current?.({ slideCount: presentation.slides.length });
  }, [presentation, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  // The slide that holds the target, found again only when the words change.
  const matched = target?.matched;
  const before = target?.before;
  const after = target?.after;
  const key = `${matched}\u0000${before}\u0000${after}`;
  const located = useMemo(
    () =>
      presentation && matched
        ? locate(presentation.slides, { matched, before, after }, showNotes)
        : null,
    [presentation, matched, before, after, showNotes],
  );

  // A slide chosen by the reader stands until the target changes and is found on another slide.
  let index = 0;
  if (slide !== undefined) {
    index = slide >= 0 && slide < slides.length ? Math.floor(slide) : 0;
  } else if (picked && (picked.key === key || located === null)) {
    index = Math.min(picked.index, Math.max(0, slides.length - 1));
  } else if (located !== null) {
    index = located;
  }
  const current = slides.at(index);

  /** @param {number} next */
  const choose = (next) => {
    if (next < 0 || next >= slides.length) return;
    setPicked({ index: next, key });
    changed.current?.(next);
  };

  // Mark the words once the slide that holds them is drawn.
  useEffect(() => {
    const root = area.current;
    if (!root || !current) return undefined;
    clearMarks(root);
    if (!matched) {
      marked.current?.(null);
      return undefined;
    }
    const mark = located === index ? markIn(root, { matched, before, after }) : null;
    marked.current?.(mark !== null);
    return () => clearMarks(root);
  }, [current, located, index, matched, before, after, showNotes, marked]);

  /** @param {import('react').KeyboardEvent} event */
  const onKeyDown = (event) => {
    const moves = new Map([
      ['ArrowRight', index + 1],
      ['PageDown', index + 1],
      ['ArrowLeft', index - 1],
      ['PageUp', index - 1],
      ['Home', 0],
      ['End', slides.length - 1],
    ]);
    const next = moves.get(event.key);
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
  };

  const loading = !error && !presentation;
  return (
    <div className={styles.root} style={themeVars(theme)} aria-busy={loading}>
      {loading && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The presentation could not be read: {error.message}
        </p>
      )}
      {presentation && current && (
        <>
          <div className={styles.toolbar}>
            <button type="button" disabled={index === 0} onClick={() => choose(index - 1)}>
              Previous slide
            </button>
            <span role="status">
              Slide {index + 1} of {slides.length}
            </span>
            <button
              type="button"
              disabled={index >= slides.length - 1}
              onClick={() => choose(index + 1)}
            >
              Next slide
            </button>
          </div>
          <div className={styles.main}>
            {thumbnails && (
              <ol aria-label={`${label} slides`} className={styles.thumbnails}>
                {slides.map((each, place) => (
                  <li key={place}>
                    <button
                      type="button"
                      className={styles.thumbnail}
                      aria-label={`Slide ${place + 1}${each.title ? `: ${each.title}` : ''}`}
                      aria-current={place === index ? 'true' : undefined}
                      onClick={() => choose(place)}
                    >
                      <span aria-hidden="true" className={styles.thumbnailSlide}>
                        <SlideView
                          slide={each}
                          width={presentation.width}
                          height={presentation.height}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div ref={area} className={styles.stageArea}>
              {/* The slide takes focus so the arrow keys can move between slides. */}
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
              <div
                role="group"
                aria-roledescription="slide"
                aria-label={`${label}, slide ${index + 1} of ${slides.length}${current.title ? `: ${current.title}` : ''}`}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                className={styles.stage}
                onKeyDown={onKeyDown}
              >
                <SlideView
                  slide={current}
                  width={presentation.width}
                  height={presentation.height}
                />
              </div>
              {showNotes && current.notes && (
                <aside aria-label="Speaker notes" className={styles.notes}>
                  {current.notes}
                </aside>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
