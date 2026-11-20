import {
  applyTheme,
  clearMarks,
  createShell,
  loadSource,
  markIn,
} from '@coldsofttech/fovea-viewers/core/vanilla';
import { locate, parsePresentation } from '../parsePresentation.js';
import { slideView } from './slideView.js';
import styles from '../PowerpointViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerTheme} ViewerTheme
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../parsePresentation.js').Presentation} Presentation
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
 * A viewer for a PowerPoint presentation, drawn into a container: the slide with its text, tables
 * and pictures placed as in the file, buttons and keys to move between slides, small slides to
 * choose from, and speaker notes. Animations, charts, SmartArt and theme colours and fonts are not
 * shown.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {PowerpointViewerProps} props
 * @returns {ViewerController}
 */
export function createPowerpointViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;

  /** @type {Presentation | null} */
  let presentation = null;
  /** @type {Error | null} */
  let error = null;
  /** @type {{ index: number, key: string } | null} */
  let picked = null;
  /** @type {HTMLElement[]} */
  let messages = [];
  /** @type {{ presentation: Presentation, thumbnails: boolean, toolbar: HTMLElement, previous: HTMLButtonElement, next: HTMLButtonElement, status: HTMLElement, main: HTMLElement, list: HTMLElement | null, buttons: HTMLElement[], stage: HTMLElement, area: HTMLElement, shown: number, notes: HTMLElement | null } | null} */
  let view = null;
  /** @type {{ presentation: Presentation | null, key: string, showNotes: boolean, found: number | null } | null} */
  let locatedCache = null;
  /** @type {Presentation | null} */
  let reported = null;
  /** @type {Error | null} */
  let failed = null;
  let markedFor = '';
  /** @type {WeakMap<Presentation, number>} */
  const ids = new WeakMap();
  let issued = 0;

  const targetKey = () => {
    const { target } = shell.props;
    return `${target?.matched}\u0000${target?.before}\u0000${target?.after}`;
  };

  /** The slide that holds the target, found again only when the words change. */
  function located() {
    const { target, showNotes = true } = shell.props;
    const key = targetKey();
    if (!(
      locatedCache &&
      locatedCache.presentation === presentation &&
      locatedCache.key === key &&
      locatedCache.showNotes === showNotes
    )) {
      locatedCache = {
        presentation,
        key,
        showNotes,
        found:
          presentation && target?.matched
            ? locate(
                presentation.slides,
                { matched: target.matched, before: target.before, after: target.after },
                showNotes,
              )
            : null,
      };
    }
    return locatedCache.found;
  }

  /** The place of the slide shown: the host's choice, the reader's, or where the target is. */
  function slideIndex() {
    const slides = presentation?.slides ?? [];
    const found = located();
    const { slide } = shell.props;
    if (slide !== undefined) return slide >= 0 && slide < slides.length ? Math.floor(slide) : 0;
    // A slide chosen by the reader stands until the target changes and is found on another slide.
    if (picked && (picked.key === targetKey() || found === null)) {
      return Math.min(picked.index, Math.max(0, slides.length - 1));
    }
    return found !== null ? found : 0;
  }

  /** @param {number} next */
  function choose(next) {
    const slides = presentation?.slides ?? [];
    if (next < 0 || next >= slides.length) return;
    picked = { index: next, key: targetKey() };
    render();
    shell.emit('onSlideChange', next);
  }

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    const slides = presentation?.slides ?? [];
    const index = slideIndex();
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
  }

  function dropView() {
    view?.toolbar.remove();
    view?.main.remove();
    view = null;
  }

  function buildView(/** @type {Presentation} */ book, /** @type {boolean} */ thumbnails) {
    const previous = /** @type {HTMLButtonElement} */ (
      h('button', { type: 'button', onclick: () => choose(slideIndex() - 1) }, 'Previous slide')
    );
    const next = /** @type {HTMLButtonElement} */ (
      h('button', { type: 'button', onclick: () => choose(slideIndex() + 1) }, 'Next slide')
    );
    const status = h('span', { role: 'status' });
    const toolbar = h('div', { class: styles.toolbar }, previous, status, next);

    /** @type {HTMLElement | null} */
    let list = null;
    /** @type {HTMLElement[]} */
    let buttons = [];
    if (thumbnails) {
      buttons = book.slides.map((each, place) =>
        h(
          'button',
          {
            type: 'button',
            class: styles.thumbnail,
            'aria-label': `Slide ${place + 1}${each.title ? `: ${each.title}` : ''}`,
            onclick: () => choose(place),
          },
          h(
            'span',
            { 'aria-hidden': 'true', class: styles.thumbnailSlide },
            slideView(h, each, book.width, book.height),
          ),
        ),
      );
      list = h(
        'ol',
        { class: styles.thumbnails },
        buttons.map((button) => h('li', null, button)),
      );
    }
    // The slide takes focus so the arrow keys can move between slides.
    const stage = h('div', {
      role: 'group',
      'aria-roledescription': 'slide',
      tabindex: '0',
      class: styles.stage,
      onkeydown: onKeyDown,
    });
    const area = h('div', { class: styles.stageArea }, stage);
    const main = h('div', { class: styles.main }, list, area);
    root.append(toolbar, main);
    return {
      presentation: book,
      thumbnails,
      toolbar,
      previous,
      next,
      status,
      main,
      list,
      buttons,
      stage,
      area,
      shown: -1,
      notes: null,
    };
  }

  function render() {
    const loading = !error && !presentation;
    root.setAttribute('aria-busy', String(loading));
    for (const message of messages) message.remove();
    messages = [];
    if (loading) messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (error) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The presentation could not be read: ${error.message}`,
        ),
      );
    }
    root.prepend(...messages);

    const slides = presentation?.slides ?? [];
    const index = slideIndex();
    const current = slides.at(index);
    const { label = 'Presentation', showNotes = true, thumbnails = true } = shell.props;

    if (!presentation || !current) {
      dropView();
    } else {
      if (!view || view.presentation !== presentation || view.thumbnails !== thumbnails) {
        dropView();
        view = buildView(presentation, thumbnails);
      }
      view.previous.disabled = index === 0;
      view.next.disabled = index >= slides.length - 1;
      view.status.textContent = `Slide ${index + 1} of ${slides.length}`;
      if (view.list) {
        view.list.setAttribute('aria-label', `${label} slides`);
        view.buttons.forEach((button, place) => {
          if (place === index) button.setAttribute('aria-current', 'true');
          else button.removeAttribute('aria-current');
        });
      }
      view.stage.setAttribute(
        'aria-label',
        `${label}, slide ${index + 1} of ${slides.length}${current.title ? `: ${current.title}` : ''}`,
      );
      if (view.shown !== index) {
        view.stage.replaceChildren(slideView(h, current, presentation.width, presentation.height));
        view.shown = index;
      }
      view.notes?.remove();
      view.notes = null;
      if (showNotes && current.notes) {
        view.notes = h(
          'aside',
          { 'aria-label': 'Speaker notes', class: styles.notes },
          current.notes,
        );
        view.area.append(view.notes);
      }
    }

    markWords(index, current);

    if (presentation && presentation !== reported) {
      shell.emit('onReady', { slideCount: presentation.slides.length });
    }
    reported = presentation;
    if (error && error !== failed) shell.emit('onError', error);
    failed = error;
  }

  /** Marks the words once the slide that holds them is drawn. */
  function markWords(/** @type {number} */ index, /** @type {unknown} */ current) {
    if (!view || !current) return;
    const { target, showNotes = true } = shell.props;
    if (presentation && !ids.has(presentation)) ids.set(presentation, ++issued);
    const signature = `${presentation ? ids.get(presentation) : 0}:${index}:${targetKey()}:${showNotes}`;
    if (signature === markedFor) return;
    markedFor = signature;
    clearMarks(view.area);
    if (!target?.matched) {
      shell.emit('onMarked', null);
      return;
    }
    const mark =
      located() === index
        ? markIn(view.area, { matched: target.matched, before: target.before, after: target.after })
        : null;
    shell.emit('onMarked', mark !== null);
  }

  function reload() {
    presentation = null;
    error = null;
    picked = null;
    markedFor = '';
    render();
    shell.load(
      async (signal) => {
        const blob = await loadSource(shell.props.source, { fetcher: shell.props.fetcher, signal });
        return parsePresentation(blob);
      },
      {
        onResult(loaded) {
          presentation = loaded;
          render();
        },
        onError(failure) {
          error = failure;
          render();
        },
      },
    );
  }

  applyTheme(root, props.theme);
  reload();
  shell.onUpdate((changed, current) => {
    if (changed.includes('theme')) applyTheme(root, current.theme);
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else render();
  });
  return shell.api;
}
