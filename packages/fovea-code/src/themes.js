/**
 * Colours like Visual Studio Code's default Light+ and Dark+ themes. Each key becomes a CSS
 * variable named `--fovea-<key>`; the `token-<kind>` keys colour the pieces of a line.
 *
 * @typedef {import('@coldsofttech/fovea-viewers/core').ViewerTheme} ViewerTheme
 */

/** @type {Record<string, string>} */
export const darkCode = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  muted: '#858585',
  border: 'transparent',
  'gutter-background': '#1e1e1e',
  'current-line': '#2a2d2e',
  'hit-background': 'rgba(234, 92, 0, 0.33)',
  'hit-outline': 'rgba(255, 255, 255, 0.25)',
  'token-comment': '#6a9955',
  'token-atrule': '#c586c0',
  'token-selector': '#d7ba7d',
  'token-property': '#9cdcfe',
  'token-value': '#ce9178',
  'token-string': '#ce9178',
  'token-number': '#b5cea8',
  'token-function': '#dcdcaa',
  'token-important': '#569cd6',
  'token-punct': '#d4d4d4',
  'token-tagpunct': '#808080',
  'token-tag': '#569cd6',
  'token-attribute': '#9cdcfe',
  'token-attrvalue': '#ce9178',
  'token-entity': '#569cd6',
  'token-doctype': '#808080',
  'token-key': '#9cdcfe',
  'token-keyword': '#c586c0',
  'token-storage': '#569cd6',
  'token-constant': '#569cd6',
  'token-identifier': '#9cdcfe',
  'token-member': '#9cdcfe',
  'token-regexp': '#d16969',
};

/** @type {Record<string, string>} */
export const lightCode = {
  background: '#ffffff',
  foreground: '#000000',
  muted: '#6e7681',
  border: 'transparent',
  'gutter-background': '#ffffff',
  'current-line': '#f3f3f3',
  'hit-background': 'rgba(234, 92, 0, 0.25)',
  'hit-outline': 'rgba(0, 0, 0, 0.2)',
  'token-comment': '#008000',
  'token-atrule': '#af00db',
  'token-selector': '#800000',
  'token-property': '#e50000',
  'token-value': '#0451a5',
  'token-string': '#a31515',
  'token-number': '#098658',
  'token-function': '#795e26',
  'token-important': '#0000ff',
  'token-punct': '#000000',
  'token-tagpunct': '#800000',
  'token-tag': '#800000',
  'token-attribute': '#e50000',
  'token-attrvalue': '#0000ff',
  'token-entity': '#ee0000',
  'token-doctype': '#808080',
  'token-key': '#0451a5',
  'token-keyword': '#af00db',
  'token-storage': '#0000ff',
  'token-constant': '#0000ff',
  'token-identifier': '#001080',
  'token-member': '#001080',
  'token-regexp': '#811f3f',
};

/**
 * The colours to give the viewer for a theme: Light+ or Dark+, or your own colours laid over
 * Light+. Code is coloured to suit a background, so with no theme it uses Light+.
 *
 * @param {ViewerTheme | undefined} theme
 * @returns {Record<string, string>}
 */
export function codeTheme(theme) {
  if (theme === 'dark') return darkCode;
  if (typeof theme === 'object' && theme !== null) return { ...lightCode, ...theme };
  return lightCode;
}
