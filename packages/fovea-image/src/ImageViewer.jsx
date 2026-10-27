import { useEffect, useMemo, useRef, useState } from 'react';
import { themeVars, useLatest, useSource } from '@coldsofttech/fovea-viewers/core';
import { ZOOM_STEP, clampPan, clampZoom, fitScale, formatSize, turn } from './view.js';
import styles from './ImageViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 * @typedef {import('./view.js').FitMode} FitMode
 */

/**
 * @typedef {object} ImageViewerProps
 * @property {ViewerSource} source The image: a URL, a Blob or File, or an ArrayBuffer. A URL
 *   without a `fetcher` is given straight to the browser; otherwise the image is loaded first.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Without it, a URL is shown with a plain `<img>`.
 * @property {ViewerTheme} [theme] `light`, `dark` or your own colours. Defaults to the page's.
 * @property {string} [label] The accessible name. Defaults to `Image`.
 * @property {string} [alt] What the image shows, for screen readers. Defaults to `label`.
 * @property {FitMode} [fit] How the image is first sized: `contain` (the default), `width` or
 *   `actual`.
 * @property {boolean} [showInfo] Show the image's size and type under it. Defaults to true.
 * @property {(info: { width: number, height: number, size: number | null, type: string | null }) => void} [onReady]
 *   Called when the image is shown. `size` and `type` are known only for an image that was loaded
 *   by the viewer, not for a URL given to the browser.
 * @property {(error: Error) => void} [onError] Called when the image cannot be loaded or shown.
 */

/** How far an arrow key moves the image, in pixels. */
const PAN_STEP = 40;

/** An SVG without a size of its own is given the browser's default replaced-element size. */
const FALLBACK = { width: 300, height: 150 };

/**
 * @param {string | null} url
 * @param {FitMode} fit
 */
const fresh = (url, fit) => ({
  url,
  mode: /** @type {FitMode | 'custom'} */ (fit),
  zoom: 1,
  rotation: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  failed: false,
});

/**
 * A viewer for an image: it fits the image to the view, and can zoom (buttons, keys and the mouse
 * wheel), pan by dragging or with the arrow keys, and turn it in quarter turns. SVG is shown as a
 * picture, so its scripts never run.
 *
 * @param {ImageViewerProps} props
 */
export function ImageViewer({
  source,
  fetcher,
  theme,
  label = 'Image',
  alt,
  fit = 'contain',
  showInfo = true,
  onReady,
  onError,
}) {
  // A URL with no fetcher goes straight to the browser. Anything else is loaded and shown from a
  // temporary address, which is released when the image changes or the viewer goes away.
  const direct = typeof source === 'string' && !fetcher;
  const loaded = useSource(direct ? null : source, fetcher);
  const [made, setMade] = useState(/** @type {{ blob: Blob, url: string } | null} */ (null));
  useEffect(() => {
    if (!loaded.blob) return undefined;
    const url = URL.createObjectURL(loaded.blob);
    // The address is made and released with the image, so it is kept in state from here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMade({ blob: loaded.blob, url });
    return () => URL.revokeObjectURL(url);
  }, [loaded.blob]);
  const blob = direct ? null : loaded.blob;
  const url = direct ? source : made && made.blob === blob ? made.url : null;

  // What the reader has done to this image: its own state, started again for a new image.
  const [state, setState] = useState(() => fresh(null, fit));
  const view = state.url === url ? state : fresh(url, fit);
  /** @param {Partial<ReturnType<typeof fresh>>} patch */
  const update = (patch) =>
    setState((previous) => ({ ...(previous.url === url ? previous : fresh(url, fit)), ...patch }));

  const stage = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = stage.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const shown = view.width > 0 && !view.failed;
  const turned = view.rotation % 180 !== 0;
  const across = turned ? view.height : view.width;
  const down = turned ? view.width : view.height;
  const scale =
    view.mode === 'custom' ? view.zoom : fitScale(view.mode, across, down, box.width, box.height);

  /** @param {number} next */
  const zoomTo = (next) => {
    const zoom = clampZoom(next);
    const ratio = zoom / scale;
    update({
      mode: 'custom',
      zoom,
      x: clampPan(view.x * ratio, across, zoom, box.width),
      y: clampPan(view.y * ratio, down, zoom, box.height),
    });
  };
  /** @param {number} factor */
  const zoomBy = (factor) => zoomTo(scale * factor);
  /** @param {FitMode} mode */
  const fitTo = (mode) => update({ mode, x: 0, y: 0 });
  /** @param {1 | -1} direction */
  const rotate = (direction) => update({ rotation: turn(view.rotation, direction), x: 0, y: 0 });
  /** @param {number} dx @param {number} dy */
  const panBy = (dx, dy) =>
    update({
      x: clampPan(view.x + dx, across, scale, box.width),
      y: clampPan(view.y + dy, down, scale, box.height),
    });

  // The mouse wheel zooms. React's own wheel listener cannot stop the page scrolling, so this one
  // is added by hand.
  const wheel = useLatest((/** @type {WheelEvent} */ event) => {
    if (!shown) return;
    event.preventDefault();
    zoomBy(Math.exp(-event.deltaY * 0.002));
  });
  useEffect(() => {
    const element = stage.current;
    if (!element) return undefined;
    const onWheel = (/** @type {WheelEvent} */ event) => wheel.current(event);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [wheel]);

  const drag = useRef(
    /** @type {{ id: number, x: number, y: number, fromX: number, fromY: number } | null} */ (null),
  );

  /** @param {import('react').KeyboardEvent} event */
  const onKeyDown = (event) => {
    if (!shown || event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = {
      '+': () => zoomBy(ZOOM_STEP),
      '=': () => zoomBy(ZOOM_STEP),
      '-': () => zoomBy(1 / ZOOM_STEP),
      _: () => zoomBy(1 / ZOOM_STEP),
      0: () => fitTo('contain'),
      1: () => fitTo('actual'),
      '[': () => rotate(-1),
      ']': () => rotate(1),
      ArrowLeft: () => panBy(PAN_STEP, 0),
      ArrowRight: () => panBy(-PAN_STEP, 0),
      ArrowUp: () => panBy(0, PAN_STEP),
      ArrowDown: () => panBy(0, -PAN_STEP),
    };
    const action = Object.hasOwn(keys, event.key)
      ? keys[/** @type {keyof typeof keys} */ (event.key)]
      : null;
    if (!action) return;
    event.preventDefault();
    action();
  };

  const failure = useMemo(
    () => (view.failed ? new Error('The image could not be shown.') : null),
    [view.failed],
  );
  const error = loaded.error ?? failure;

  const ready = useLatest(onReady);
  const failed = useLatest(onError);
  useEffect(() => {
    if (view.width > 0) {
      ready.current?.({
        width: view.width,
        height: view.height,
        size: blob ? blob.size : null,
        type: blob?.type || null,
      });
    }
  }, [view.width, view.height, blob, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  const percent = `${Math.round(scale * 100)}%`;
  const facts = [
    shown ? `${view.width} × ${view.height} px` : '',
    blob ? formatSize(blob.size) : '',
    blob?.type ?? '',
  ].filter(Boolean);

  return (
    <div className={styles.root} style={themeVars(theme)} aria-busy={!shown && !error}>
      <div className={styles.toolbar} role="toolbar" aria-label="Image controls">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!shown}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          −
        </button>
        <span className={styles.zoom}>{shown ? percent : ''}</span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!shown}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Fit to view"
          disabled={!shown}
          onClick={() => fitTo('contain')}
        >
          Fit
        </button>
        <button
          type="button"
          aria-label="Fit to width"
          disabled={!shown}
          onClick={() => fitTo('width')}
        >
          Width
        </button>
        <button
          type="button"
          aria-label="Actual size"
          disabled={!shown}
          onClick={() => fitTo('actual')}
        >
          100%
        </button>
        <button type="button" aria-label="Rotate left" disabled={!shown} onClick={() => rotate(-1)}>
          ↺
        </button>
        <button type="button" aria-label="Rotate right" disabled={!shown} onClick={() => rotate(1)}>
          ↻
        </button>
      </div>
      {!shown && !error && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The image could not be loaded: {error.message}
        </p>
      )}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={stage}
        role="region"
        aria-label={label}
        // The stage takes focus so the keyboard can zoom, pan and turn the image.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={styles.stage}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (!shown || event.button !== 0) return;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            fromX: view.x,
            fromY: view.y,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          update({
            x: clampPan(start.fromX + event.clientX - start.x, across, scale, box.width),
            y: clampPan(start.fromY + event.clientY - start.y, down, scale, box.height),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {url && !view.failed && (
          <img
            className={styles.image}
            src={url}
            alt={alt ?? label}
            draggable={false}
            referrerPolicy="no-referrer"
            style={{
              width: view.width || undefined,
              height: view.height || undefined,
              opacity: shown ? 1 : 0,
              transform: `translate(${view.x}px, ${view.y}px) rotate(${view.rotation}deg) scale(${scale})`,
            }}
            onLoad={(event) =>
              update({
                width: event.currentTarget.naturalWidth || FALLBACK.width,
                height: event.currentTarget.naturalHeight || FALLBACK.height,
              })
            }
            onError={() => update({ failed: true })}
          />
        )}
      </div>
      {showInfo && facts.length > 0 && <p className={styles.info}>{facts.join(' · ')}</p>}
    </div>
  );
}
