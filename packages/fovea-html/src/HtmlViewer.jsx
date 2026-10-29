import { useEffect } from 'react';
import { HtmlFrame, useLatest, useText } from '@coldsofttech/fovea-viewers/core';
import styles from './HtmlViewer.module.css';

/**
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerSource} ViewerSource
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerFetcher} ViewerFetcher
 */

/**
 * @typedef {object} HtmlViewerProps
 * @property {ViewerSource} source The page: a URL, a Blob or File, or an ArrayBuffer (UTF-8). For a
 *   URL, the page's relative addresses (pictures, stylesheets, links) resolve against it.
 * @property {ViewerFetcher} [fetcher] Loads URL sources, so the host controls authentication and
 *   transport. Defaults to `fetch`.
 * @property {boolean} [allowImages] Let http(s) pictures load. Off by default, so only pictures
 *   embedded in the page show.
 * @property {boolean} [allowStyles] Let http(s) stylesheets and fonts load. Off by default, so
 *   only the page's own styles apply.
 * @property {boolean} [allowScripts] Run the page's inline scripts. Off by default. The page then
 *   runs in a frame of its own, with no network, and the viewer can no longer reach into it: words
 *   are not marked, `onNavigate` and `links="window"` do not work, and a link only works with
 *   `links="viewer"`.
 * @property {'none' | 'viewer' | 'window'} [links] What a click on a link does. `none` (the
 *   default) does nothing, `viewer` opens the page inside the viewer, `window` opens http(s) and
 *   mailto links in a new window. Links to a place in the same page always scroll.
 * @property {(href: string, event: MouseEvent) => void} [onNavigate] Called when a link to another
 *   page is clicked, instead of doing what `links` says.
 * @property {{ before?: string, matched: string, after?: string }} [target] Words to scroll to and
 *   mark in what the page shows.
 * @property {(found: boolean | null) => void} [onMarked] Whether the target's words were found in
 *   what the page shows (`null`: there is no target).
 * @property {string} [label] The accessible name. Defaults to `Web page`.
 * @property {(info: { allowScripts: boolean }) => void} [onReady] Called when the page has loaded.
 * @property {(error: Error) => void} [onError] Called when the file cannot be loaded.
 */

/**
 * A web page in a frame that lets nothing in unless the host allows it: no pictures, styles or
 * fonts from the web, no scripts, and links that do nothing. It can scroll to and mark some words.
 *
 * @param {HtmlViewerProps} props
 */
export function HtmlViewer({
  source,
  fetcher,
  allowImages = false,
  allowStyles = false,
  allowScripts = false,
  links = 'none',
  onNavigate,
  target,
  onMarked,
  label = 'Web page',
  onReady,
  onError,
}) {
  const { status, text, error } = useText(source, fetcher);
  const failed = useLatest(onError);

  useEffect(() => {
    if (error) failed.current?.(error);
  }, [error, failed]);

  return (
    <div className={styles.root}>
      {status === 'loading' && (
        <p role="status" className={styles.message}>
          Loading…
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className={styles.message}>
          The page could not be loaded: {error?.message}
        </p>
      )}
      <HtmlFrame
        html={text}
        base={typeof source === 'string' ? source : undefined}
        allowImages={allowImages}
        allowStyles={allowStyles}
        allowScripts={allowScripts}
        links={links}
        onNavigate={onNavigate}
        target={target}
        onMarked={onMarked}
        label={label}
        onReady={onReady}
      />
    </div>
  );
}
