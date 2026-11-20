import { createHtmlFrame, createShell, loadSource } from '@coldsofttech/fovea-viewers/core/vanilla';
import { parseEmail } from '../parse.js';
import { saveAttachment } from '../save.js';
import styles from '../EmailViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerFetcher} ViewerFetcher
 * @typedef {import('@coldsofttech/fovea-viewers/core/vanilla').ViewerController} ViewerController
 * @typedef {import('../parse.js').ParsedEmail} ParsedEmail
 * @typedef {import('../parse.js').EmailAttachment} EmailAttachment
 */

/**
 * @typedef {object} EmailViewerProps
 * @property {ViewerSource} source The message: a URL, a Blob or File, or an ArrayBuffer (`.eml`).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {boolean} [allowImages] Let http(s) pictures in the message load. Off by default, so
 *   only pictures embedded in the message show.
 * @property {boolean} [allowStyles] Let http(s) stylesheets and fonts load. Off by default.
 * @property {'none' | 'window'} [links] What a click on a link in the message does. `none` (the
 *   default) does nothing, `window` opens http(s) and mailto links in a new window.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link is
 *   clicked, instead of doing what `links` says.
 * @property {'html' | 'text'} [view] Which version of the message to show first. Defaults to
 *   `html` when the message has one.
 * @property {(attachment: EmailAttachment) => void} [onAttachment] Called when an attachment is
 *   clicked, instead of downloading it.
 * @property {string} [label] The accessible name of the message body. Defaults to `Email message`.
 * @property {(email: ParsedEmail) => void} [onReady] Called when the message has loaded.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded.
 */

/** @param {number} bytes */
function sizeOf(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** @param {{ name: string, address: string }} person */
const nameOf = ({ name, address }) => (name && address ? `${name} <${address}>` : name || address);

/**
 * An email message (`.eml`), drawn into a container: who it is from and to, its subject and date,
 * the message itself (in a frame that lets nothing in unless the host allows it), its attachments
 * and its raw headers.
 *
 * @param {HTMLElement | ShadowRoot} container
 * @param {EmailViewerProps} props
 * @returns {ViewerController}
 */
export function createEmailViewer(container, props) {
  const shell = createShell(container, props, { className: styles.root });
  const { root, h } = shell;

  /** @type {ParsedEmail | null} */
  let email = null;
  /** @type {Error | null} */
  let error = null;
  /** @type {'html' | 'text' | null} */
  let chosen = null;
  /** @type {HTMLElement[]} */
  let messages = [];
  /** @type {{ email: ParsedEmail, header: HTMLElement, body: HTMLElement, formatted?: HTMLElement, plain?: HTMLElement } | null} */
  let built = null;
  /** @type {ViewerController | null} */
  let frame = null;
  /** @type {HTMLElement | null} */
  let textBox = null;
  /** @type {HTMLElement | null} */
  let empty = null;

  /** Which version of the message to show: the one asked for, or the one there is. */
  function shownVersion() {
    if (!email) return null;
    const wanted = chosen ?? shell.props.view ?? 'html';
    if (wanted === 'html' && email.html !== null) return 'html';
    if (email.text !== null) return 'text';
    return email.html !== null ? 'html' : null;
  }

  function frameProps() {
    const {
      allowImages = false,
      allowStyles = false,
      links = 'none',
      label = 'Email message',
    } = shell.props;
    return {
      html: email?.html ?? null,
      allowImages,
      allowStyles,
      links,
      onNavigate: shell.props.onNavigate
        ? (/** @type {string} */ href, /** @type {MouseEvent} */ event) =>
            shell.emit('onNavigate', href, event)
        : undefined,
      label,
    };
  }

  /** The subject, fields, version buttons, attachments and raw headers: made once for a message. */
  function buildHeader(/** @type {ParsedEmail} */ message) {
    const fields = [
      ['From', message.from ? nameOf(message.from) : ''],
      ['To', message.to.map(nameOf).join(', ')],
      ['Cc', message.cc.map(nameOf).join(', ')],
      ['Bcc', message.bcc.map(nameOf).join(', ')],
      ['Date', message.date ? message.date.toLocaleString() : ''],
    ].filter(([, value]) => value);

    const header = h(
      'header',
      { class: styles.header },
      h('h2', { class: styles.subject }, message.subject || '(no subject)'),
      h(
        'dl',
        { class: styles.fields },
        fields.map(([name, value]) =>
          h('div', { class: styles.field }, h('dt', null, name), h('dd', null, value)),
        ),
      ),
    );
    /** @type {{ formatted?: HTMLElement, plain?: HTMLElement }} */
    const toggles = {};
    if (message.html !== null && message.text !== null) {
      toggles.formatted = h(
        'button',
        { type: 'button', onclick: () => choose('html') },
        'Formatted',
      );
      toggles.plain = h('button', { type: 'button', onclick: () => choose('text') }, 'Plain text');
      header.append(
        h(
          'div',
          { role: 'group', 'aria-label': 'Message version', class: styles.toolbar },
          toggles.formatted,
          toggles.plain,
        ),
      );
    }
    if (message.attachments.length > 0) {
      header.append(
        h(
          'ul',
          { 'aria-label': 'Attachments', class: styles.attachments },
          message.attachments.map((attachment) =>
            h(
              'li',
              null,
              h(
                'button',
                {
                  type: 'button',
                  class: styles.attachment,
                  onclick: () =>
                    shell.props.onAttachment
                      ? shell.emit('onAttachment', attachment)
                      : saveAttachment(root.ownerDocument, attachment),
                },
                `${attachment.filename} (${sizeOf(attachment.size)})`,
              ),
            ),
          ),
        ),
      );
    }
    header.append(
      h(
        'details',
        { class: styles.raw },
        h('summary', null, 'Raw headers'),
        h(
          'pre',
          { class: styles.rawList },
          message.headers.map(({ key, value }) => `${key}: ${value}`).join('\n'),
        ),
      ),
    );
    return { header, ...toggles };
  }

  /** @param {'html' | 'text'} version */
  function choose(version) {
    chosen = version;
    renderBody();
  }

  function renderBody() {
    if (!built || !email) return;
    const shown = shownVersion();
    built.formatted?.setAttribute('aria-pressed', String(shown === 'html'));
    built.plain?.setAttribute('aria-pressed', String(shown === 'text'));

    if (shown === 'html') {
      textBox?.remove();
      textBox = null;
      empty?.remove();
      empty = null;
      if (frame) frame.update(frameProps());
      else frame = createHtmlFrame(built.body, frameProps());
    } else {
      frame?.destroy();
      frame = null;
    }
    if (shown === 'text') {
      empty?.remove();
      empty = null;
      if (!textBox) {
        // A scrolling region must take focus, so the keyboard can scroll it.
        textBox = h('pre', { class: styles.text, tabindex: '0' });
        built.body.append(textBox);
      }
      textBox.setAttribute('aria-label', shell.props.label ?? 'Email message');
      textBox.textContent = email.text;
    } else {
      textBox?.remove();
      textBox = null;
    }
    if (shown === null) {
      empty ??= built.body.appendChild(
        h('p', { class: styles.message }, 'This message has no content.'),
      );
    }
  }

  function render() {
    for (const message of messages) message.remove();
    messages = [];
    if (!error && !email)
      messages.push(h('p', { role: 'status', class: styles.message }, 'Loading…'));
    if (error) {
      messages.push(
        h(
          'p',
          { role: 'alert', class: styles.message },
          `The message could not be loaded: ${error.message}`,
        ),
      );
    }
    root.prepend(...messages);

    if (!email) {
      built?.header.remove();
      built?.body.remove();
      frame?.destroy();
      frame = null;
      textBox = null;
      empty = null;
      built = null;
      return;
    }
    if (built?.email !== email) {
      built?.header.remove();
      built?.body.remove();
      frame?.destroy();
      frame = null;
      textBox = null;
      empty = null;
      const parts = buildHeader(email);
      const body = h('div', { class: styles.body });
      root.append(parts.header, body);
      built = { email, header: parts.header, body, formatted: parts.formatted, plain: parts.plain };
    }
    renderBody();
  }

  function reload() {
    email = null;
    error = null;
    chosen = null;
    render();
    shell.load(
      async (signal) => {
        const blob = await loadSource(shell.props.source, { fetcher: shell.props.fetcher, signal });
        return parseEmail(blob);
      },
      {
        onResult(loaded) {
          email = loaded;
          render();
          shell.emit('onReady', loaded);
        },
        onError(failure) {
          error = failure;
          render();
          shell.emit('onError', failure);
        },
      },
    );
  }

  shell.cleanup(() => frame?.destroy());
  reload();
  shell.onUpdate((changed) => {
    if (changed.includes('source') || changed.includes('fetcher')) reload();
    else renderBody();
  });
  return shell.api;
}
