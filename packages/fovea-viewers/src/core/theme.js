/**
 * @typedef {Record<string, string>} ThemeTokens
 * Colours by name, for example `{ background: '#fff' }`. Each becomes a CSS custom property
 * named `--fovea-<name>` on the viewer.
 */

/**
 * @typedef {'light' | 'dark' | ThemeTokens} ViewerTheme
 * `light` or `dark` for the built-in colours, or your own tokens. Leave it out to use the
 * page's own colours.
 */

/** @type {ThemeTokens} */
export const lightTheme = {
  background: '#ffffff',
  foreground: '#242424',
  muted: '#707070',
  border: '#e0e0e0',
  'gutter-background': '#fafafa',
  'current-line': '#f5f5f5',
  'hit-background': 'rgba(255, 196, 0, 0.45)',
  'hit-outline': 'rgba(214, 140, 0, 0.8)',
  link: '#0f6cbd',
  'code-background': '#f5f5f5',
};

/** @type {ThemeTokens} */
export const darkTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  muted: '#858585',
  border: '#3c3c3c',
  'gutter-background': '#1e1e1e',
  'current-line': '#2a2d2e',
  'hit-background': 'rgba(234, 92, 0, 0.33)',
  'hit-outline': 'rgba(255, 255, 255, 0.25)',
  link: '#3794ff',
  'code-background': '#2d2d2d',
};

/**
 * Turns a theme into CSS custom properties for a viewer's `style`.
 *
 * @param {ViewerTheme | undefined} theme
 * @returns {Record<string, string> | undefined} `undefined` when the page's own colours apply.
 */
export function themeVars(theme) {
  let tokens = theme;
  if (theme === 'light') tokens = lightTheme;
  else if (theme === 'dark') tokens = darkTheme;
  if (typeof tokens !== 'object' || !tokens) return undefined;
  return Object.fromEntries(
    Object.entries(tokens).map(([name, value]) => [`--fovea-${name}`, value]),
  );
}
