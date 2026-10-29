import { useEffect, useMemo, useState } from 'react';
import { HtmlFrame, useLatest, useSource } from '@coldsofttech/fovea-viewers/core';
import { parseEmail } from './parse.js';
import styles from './EmailViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('./parse.js').ParsedEmail} ParsedEmail
 * @typedef {import('./parse.js').EmailAttachment} EmailAttachment
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
 * Saves an attachment, by way of an address that is made for the click and let go of after.
 *
 * @param {EmailAttachment} attachment
 */
function save(attachment) {
  const url = URL.createObjectURL(attachment.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * An email message (`.eml`): who it is from and to, its subject and date, the message itself (in a
 * frame that lets nothing in unless the host allows it), its attachments and its raw headers.
 *
 * @param {EmailViewerProps} props
 */
export function EmailViewer({
  source,
  fetcher,
  allowImages = false,
  allowStyles = false,
  links = 'none',
  onNavigate,
  view,
  onAttachment,
  label = 'Email message',
  onReady,
  onError,
}) {
  const loaded = useSource(source, fetcher);
  const [parsed, setParsed] = useState(
    /** @type {{ blob: Blob, email?: ParsedEmail, error?: Error } | null} */ (null),
  );
  const [chosen, setChosen] = useState(/** @type {'html' | 'text' | null} */ (null));
  const ready = useLatest(onReady);
  const failed = useLatest(onError);

  useEffect(() => {
    const { blob } = loaded;
    if (!blob) return undefined;
    let current = true;
    parseEmail(blob).then(
      (email) => current && setParsed({ blob, email }),
      (error) =>
        current &&
        setParsed({ blob, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      current = false;
    };
  }, [loaded]);

  const email = parsed?.blob === loaded.blob ? (parsed?.email ?? null) : null;
  const error = loaded.error ?? (parsed?.blob === loaded.blob ? (parsed?.error ?? null) : null);

  useEffect(() => {
    if (email) ready.current?.(email);
  }, [email, ready]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  const shown = useMemo(() => {
    if (!email) return null;
    const wanted = chosen ?? view ?? 'html';
    if (wanted === 'html' && email.html !== null) return 'html';
    if (email.text !== null) return 'text';
    return email.html !== null ? 'html' : null;
  }, [email, chosen, view]);

  const loading = !error && !email;
  const fields = email
    ? [
        ['From', email.from ? nameOf(email.from) : ''],
        ['To', email.to.map(nameOf).join(', ')],
        ['Cc', email.cc.map(nameOf).join(', ')],
        ['Bcc', email.bcc.map(nameOf).join(', ')],
        ['Date', email.date ? email.date.toLocaleString() : ''],
      ].filter(([, value]) => value)
    : [];

  return (
    <div className={styles.root}>
      {loading && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The message could not be loaded: {error.message}
        </p>
      )}
      {email && (
        <>
          <header className={styles.header}>
            <h2 className={styles.subject}>{email.subject || '(no subject)'}</h2>
            <dl className={styles.fields}>
              {fields.map(([name, value]) => (
                <div key={name} className={styles.field}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {email.html !== null && email.text !== null && (
              <div role="group" aria-label="Message version" className={styles.toolbar}>
                <button
                  type="button"
                  aria-pressed={shown === 'html'}
                  onClick={() => setChosen('html')}
                >
                  Formatted
                </button>
                <button
                  type="button"
                  aria-pressed={shown === 'text'}
                  onClick={() => setChosen('text')}
                >
                  Plain text
                </button>
              </div>
            )}
            {email.attachments.length > 0 && (
              <ul aria-label="Attachments" className={styles.attachments}>
                {email.attachments.map((attachment, index) => (
                  <li key={`${index}-${attachment.filename}`}>
                    <button
                      type="button"
                      className={styles.attachment}
                      onClick={() => (onAttachment ? onAttachment(attachment) : save(attachment))}
                    >
                      {attachment.filename} ({sizeOf(attachment.size)})
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <details className={styles.raw}>
              <summary>Raw headers</summary>
              <pre className={styles.rawList}>
                {email.headers.map(({ key, value }) => `${key}: ${value}`).join('\n')}
              </pre>
            </details>
          </header>
          <div className={styles.body}>
            {shown === 'html' && (
              <HtmlFrame
                html={email.html}
                allowImages={allowImages}
                allowStyles={allowStyles}
                links={links}
                onNavigate={onNavigate}
                label={label}
              />
            )}
            {shown === 'text' && (
              // A scrolling region must take focus, so the keyboard can scroll it.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              <pre className={styles.text} aria-label={label} tabIndex={0}>
                {email.text}
              </pre>
            )}
            {shown === null && <p className={styles.message}>This message has no content.</p>}
          </div>
        </>
      )}
    </div>
  );
}
