import { useEffect, useState } from 'react';
import { HtmlFrame, useLatest, useSource } from '@coldsofttech/fovea-viewers/core';
import { convertDocument } from './convert.js';
import styles from './WordViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 * @typedef {import('./convert.js').ConversionMessage} ConversionMessage
 */

/**
 * @typedef {object} WordViewerProps
 * @property {ViewerSource} source The document: a URL, a Blob or File, or an ArrayBuffer (`.docx`
 *   or `.docm`; macros are never run).
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {'none' | 'window'} [links] What a click on a link in the document does. `none` (the
 *   default) does nothing, `window` opens http(s) and mailto links in a new window.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link is
 *   clicked, instead of doing what `links` says.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to scroll to and
 *   mark in the document.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found
 *   (`null`: there is no target).
 * @property {string} [label] The accessible name. Defaults to `Word document`.
 * @property {(info: { messages: ConversionMessage[] }) => void} [onReady] Called when the document
 *   has been read, with what could not be shown as it is in the file.
 * @property {(messages: ConversionMessage[]) => void} [onWarnings] Called when the document has
 *   something that could not be shown as it is, for example a style that has no match.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded or read.
 */

/**
 * A viewer for a Word document: its text, headings, lists, tables, links and pictures, shown in a
 * frame that lets nothing in unless the host allows it. Fonts, page layout, headers and footers are
 * not kept.
 *
 * @param {WordViewerProps} props
 */
export function WordViewer({
  source,
  fetcher,
  links = 'none',
  onNavigate,
  target,
  onMarked,
  label = 'Word document',
  onReady,
  onWarnings,
  onError,
}) {
  const loaded = useSource(source, fetcher);
  const [converted, setConverted] = useState(
    /** @type {{ blob: Blob, page?: import('./convert.js').ConvertedDocument, error?: Error } | null} */ (
      null
    ),
  );
  const ready = useLatest(onReady);
  const warned = useLatest(onWarnings);
  const failed = useLatest(onError);

  useEffect(() => {
    const { blob } = loaded;
    if (!blob) return undefined;
    let current = true;
    convertDocument(blob).then(
      (page) => current && setConverted({ blob, page }),
      (error) =>
        current &&
        setConverted({ blob, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      current = false;
    };
  }, [loaded]);

  const page = converted?.blob === loaded.blob ? (converted?.page ?? null) : null;
  const error =
    loaded.error ?? (converted?.blob === loaded.blob ? (converted?.error ?? null) : null);

  useEffect(() => {
    if (!page) return;
    ready.current?.({ messages: page.messages });
    if (page.messages.length > 0) warned.current?.(page.messages);
  }, [page, ready, warned]);
  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  const loading = !error && !page;
  return (
    <div className={styles.root} aria-busy={loading}>
      {loading && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className={styles.message}>
          The document could not be read: {error.message}
        </p>
      )}
      <HtmlFrame
        html={page?.html ?? null}
        links={links}
        onNavigate={onNavigate}
        target={target}
        onMarked={onMarked}
        label={label}
      />
    </div>
  );
}
