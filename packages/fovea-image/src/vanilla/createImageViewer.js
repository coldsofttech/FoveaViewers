import { applyTheme, createShell, loadSource } from '@coldsofttech/fovea-viewers/core/vanilla';
import { ZOOM_STEP, clampPan, clampZoom, fitScale, formatSize, turn } from '../view.js';
import styles from '../ImageViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../view.js').FitMode} FitMode
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
 *   `actual`. Changing it applies until the image has loaded or the reader has zoomed.
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
 * What the reader has done to one image. It starts again for a new image.
 *
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
 * A viewer for an image, drawn into a container: it fits the image to the view, and can zoom
 * (buttons, keys and the mouse wheel), pan by dragging or with the arrow keys, and turn it in
 * quarter turns. SVG is shown as a picture, so its scripts never run.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {ImageViewerProps} props
 * @returns {ViewerController}
 */
export function createImageViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;
  const fitProp = () => shell.props.fit ?? 'contain';

  /** @type {string | null} */
  let url = null;
  /** @type {Blob | null} */
  let blob = null;
  /** The temporary address made for a loaded image, released when the image changes. */
  /** @type {string | null} */
  let made = null;
  /** @type {Error | null} */
  let loadError = null;
  let view = fresh(null, fitProp());
  let box = { width: 0, height: 0 };
  /** @type {{ id: number, x: number, y: number, fromX: number, fromY: number } | null} */
  let drag = null;
  /** @type {HTMLImageElement | null} */
  let image = null;

  // The toolbar: a button for each thing the keyboard can also do.
  /** @param {string} name @param {string} text @param {() => void} act */
  const button = (name, text, act) =>
    h('button', { type: 'button', 'aria-label': name, onclick: act }, text);
  const zoomOut = button('Zoom out', '−', () => zoomBy(1 / ZOOM_STEP));
  const zoomText = h('span', { class: styles.zoom });
  const zoomIn = button('Zoom in', '+', () => zoomBy(ZOOM_STEP));
  const buttons = [
    zoomOut,
    zoomIn,
    button('Fit to view', 'Fit', () => fitTo('contain')),
    button('Fit to width', 'Width', () => fitTo('width')),
    button('Actual size', '100%', () => fitTo('actual')),
    button('Rotate left', '↺', () => rotate(-1)),
    button('Rotate right', '↻', () => rotate(1)),
  ];
  const toolbar = h(
    'div',
    { class: styles.toolbar, role: 'toolbar', 'aria-label': 'Image controls' },
    zoomOut,
    zoomText,
    ...buttons.slice(1),
  );
  const stage = h('div', {
    class: styles.stage,
    role: 'region',
    // The stage takes focus so the keyboard can zoom, pan and turn the image.
    tabindex: '0',
  });
  root.append(toolbar, stage);
  /** @type {HTMLElement | null} */
  let message = null;
  /** @type {HTMLElement | null} */
  let info = null;

  /** The numbers the controls work from. */
  function metrics() {
    const shown = view.width > 0 && !view.failed;
    const turned = view.rotation % 180 !== 0;
    const across = turned ? view.height : view.width;
    const down = turned ? view.width : view.height;
    const scale =
      view.mode === 'custom' ? view.zoom : fitScale(view.mode, across, down, box.width, box.height);
    return { shown, across, down, scale };
  }

  /** @param {Partial<ReturnType<typeof fresh>>} patch */
  function update(patch) {
    view = { ...view, ...patch };
    render();
  }

  /** @param {number} next */
  function zoomTo(next) {
    const { across, down, scale } = metrics();
    const zoom = clampZoom(next);
    const ratio = zoom / scale;
    update({
      mode: 'custom',
      zoom,
      x: clampPan(view.x * ratio, across, zoom, box.width),
      y: clampPan(view.y * ratio, down, zoom, box.height),
    });
  }
  /** @param {number} factor */
  function zoomBy(factor) {
    zoomTo(metrics().scale * factor);
  }
  /** @param {FitMode} mode */
  function fitTo(mode) {
    update({ mode, x: 0, y: 0 });
  }
  /** @param {1 | -1} direction */
  function rotate(direction) {
    update({ rotation: turn(view.rotation, direction), x: 0, y: 0 });
  }
  /** @param {number} dx @param {number} dy */
  function panBy(dx, dy) {
    const { across, down, scale } = metrics();
    update({
      x: clampPan(view.x + dx, across, scale, box.width),
      y: clampPan(view.y + dy, down, scale, box.height),
    });
  }

  /**
   * Shows a line of status or error text between the toolbar and the stage.
   *
   * @param {'status' | 'alert' | null} role
   * @param {string} text
   */
  function setMessage(role, text) {
    if (!role) {
      message?.remove();
      message = null;
      return;
    }
    if (!message || message.getAttribute('role') !== role) {
      message?.remove();
      message = h('p', { role, class: styles.message });
      toolbar.after(message);
    }
    message.textContent = text;
  }

  function render() {
    const { shown, scale } = metrics();
    const error = loadError ?? (view.failed ? new Error('The image could not be shown.') : null);
    root.setAttribute('aria-busy', String(!shown && !error));
    for (const control of buttons) /** @type {HTMLButtonElement} */ (control).disabled = !shown;
    zoomText.textContent = shown ? `${Math.round(scale * 100)}%` : '';

    if (error) setMessage('alert', `The image could not be loaded: ${error.message}`);
    else setMessage(shown ? null : 'status', 'Loading…');

    stage.setAttribute('aria-label', shell.props.label ?? 'Image');
    // A picture that failed is taken out, so the browser's broken-image mark is not shown.
    if (image && view.failed) {
      image.remove();
      image = null;
    }
    if (image) {
      image.alt = shell.props.alt ?? shell.props.label ?? 'Image';
      image.style.width = view.width ? `${view.width}px` : '';
      image.style.height = view.height ? `${view.height}px` : '';
      image.style.opacity = shown ? '1' : '0';
      image.style.transform = `translate(${view.x}px, ${view.y}px) rotate(${view.rotation}deg) scale(${scale})`;
    }

    const facts = [
      shown ? `${view.width} × ${view.height} px` : '',
      blob ? formatSize(blob.size) : '',
      blob?.type ?? '',
    ].filter(Boolean);
    if (shell.props.showInfo !== false && facts.length > 0) {
      info ??= root.appendChild(h('p', { class: styles.info }));
      info.textContent = facts.join(' · ');
    } else {
      info?.remove();
      info = null;
    }
  }

  /**
   * The `<img>` for an address, started again whenever the address changes.
   *
   * @param {string | null} next
   */
  function showUrl(next) {
    url = next;
    view = fresh(url, fitProp());
    image?.remove();
    image = null;
    if (url) {
      image = /** @type {HTMLImageElement} */ (
        h('img', {
          class: styles.image,
          src: url,
          draggable: 'false',
          referrerpolicy: 'no-referrer',
        })
      );
      image.addEventListener('load', () => {
        const target = /** @type {HTMLImageElement} */ (image);
        update({
          width: target.naturalWidth || FALLBACK.width,
          height: target.naturalHeight || FALLBACK.height,
        });
        shell.emit('onReady', {
          width: view.width,
          height: view.height,
          size: blob ? blob.size : null,
          type: blob?.type || null,
        });
      });
      image.addEventListener('error', () => {
        update({ failed: true });
        shell.emit('onError', new Error('The image could not be shown.'));
      });
      stage.append(image);
    }
    render();
  }

  function release() {
    if (made) URL.revokeObjectURL(made);
    made = null;
  }

  /** Starts on a new source. A URL with no fetcher goes straight to the browser. */
  function open() {
    release();
    blob = null;
    loadError = null;
    const { source, fetcher } = shell.props;
    if (typeof source === 'string' && !fetcher) {
      shell.cancel();
      showUrl(source);
      return;
    }
    showUrl(null);
    shell.load((signal) => loadSource(source, { fetcher, signal }), {
      onResult(loaded) {
        blob = loaded;
        made = URL.createObjectURL(loaded);
        showUrl(made);
      },
      onError(error) {
        loadError = error;
        render();
        shell.emit('onError', error);
      },
    });
  }

  // The mouse wheel zooms. The listener must not be passive, so it can stop the page scrolling.
  stage.addEventListener(
    'wheel',
    (event) => {
      if (!metrics().shown) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * 0.002));
    },
    { passive: false },
  );

  stage.addEventListener('keydown', (event) => {
    if (!metrics().shown || event.altKey || event.ctrlKey || event.metaKey) return;
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
  });

  stage.addEventListener('pointerdown', (event) => {
    if (!metrics().shown || event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      fromX: view.x,
      fromY: view.y,
    };
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const { across, down, scale } = metrics();
    update({
      x: clampPan(drag.fromX + event.clientX - drag.x, across, scale, box.width),
      y: clampPan(drag.fromY + event.clientY - drag.y, down, scale, box.height),
    });
  });
  stage.addEventListener('pointerup', () => {
    drag = null;
  });
  stage.addEventListener('pointercancel', () => {
    drag = null;
  });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(([entry]) => {
      box = { width: entry.contentRect.width, height: entry.contentRect.height };
      render();
    });
    observer.observe(stage);
    shell.cleanup(() => observer.disconnect());
  }
  shell.cleanup(release);

  applyTheme(root, props.theme);
  open();

  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('fit') && view.width === 0 && view.mode !== 'custom') {
      view = { ...view, mode: fitProp() };
    }
    if (changed.includes('source') || changed.includes('fetcher')) open();
    else render();
  });
  return shell.api;
}
