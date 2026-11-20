import { themeVars } from '../theme.js';

/** The custom properties `applyTheme` last set on an element, so a new theme can clear them. */
const applied = new WeakMap();

/**
 * Puts a theme on a viewer's root element as `--fovea-*` custom properties, replacing the ones a
 * previous call set. With no theme the page's own colours apply, so the properties are removed.
 * Properties the host set itself (on the element's stylesheet or ancestors) are never touched.
 *
 * @param {HTMLElement} element
 * @param {import('../theme.js').ViewerTheme | undefined} theme
 */
export function applyTheme(element, theme) {
  const next = themeVars(theme) ?? {};
  for (const name of Object.keys(applied.get(element) ?? {})) {
    if (!(name in next)) element.style.removeProperty(name);
  }
  for (const [name, value] of Object.entries(next)) element.style.setProperty(name, value);
  applied.set(element, next);
}
