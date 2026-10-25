import { useEffect, useMemo, useState } from 'react';
import { useLatest } from './core/useLatest.js';
import { componentName, load, resolve } from './registry.js';

/**
 * @typedef {import('./core/types.js').ViewerProps} ViewerProps
 */

/**
 * @typedef {ViewerProps & { type?: string }} AutoViewerProps
 * @property {string} [type] The viewer to use, for example `markdown`. Worked out from the
 *   source when left out.
 */

/**
 * Opens a file in the matching viewer, loading that viewer only when it is needed. The viewer
 * is picked from `type`, or from the file name, URL or MIME type of `source`. Any other props are
 * passed to the viewer.
 *
 * @param {AutoViewerProps & Record<string, unknown>} props
 */
export function Viewer({ type, ...props }) {
  const { source, onError } = props;
  const id = type ?? resolve(/** @type {any} */ (source));
  const [loaded, setLoaded] = useState(
    /** @type {{ id: string, Component?: any, error?: Error } | null} */ (null),
  );
  const report = useLatest(onError);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    load(id).then(
      (module) => {
        if (cancelled) return;
        const Component = module[componentName(id)];
        setLoaded(
          Component
            ? { id, Component }
            : { id, error: new Error(`The "${id}" viewer does not export ${componentName(id)}.`) },
        );
      },
      (error) => {
        if (!cancelled) setLoaded({ id, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = loaded && loaded.id === id ? loaded : null;
  const error = useMemo(
    () =>
      id
        ? (current?.error ?? null)
        : new Error('Could not tell which viewer opens this file. Pass a "type".'),
    [id, current],
  );

  useEffect(() => {
    if (error) report.current?.(error);
  }, [error, report]);

  if (error) return <p role="alert">{error.message}</p>;
  if (!current?.Component) return <p role="status">Loading…</p>;
  const { Component } = current;
  return <Component {...props} />;
}
