/**
 * The React-free half of the shared runtime: what a viewer's `/vanilla` controller and `/element`
 * are built from. Nothing here (or anything it imports) may import React; `npm run check:packages`
 * fails the build if it does.
 *
 * @typedef {import('../types.js').ViewerSource} ViewerSource
 * @typedef {import('../types.js').ViewerFetcher} ViewerFetcher
 * @typedef {import('../types.js').ViewerTheme} ViewerTheme
 * @typedef {import('../types.js').ViewerProps} ViewerProps
 * @typedef {import('./shell.js').ViewerController} ViewerController
 * @typedef {import('./shell.js').Shell} Shell
 * @typedef {import('./grid.js').GridCell} GridCell
 * @typedef {import('./grid.js').GridProps} GridProps
 * @typedef {import('./grid.js').GridSort} GridSort
 */

export { readSource as loadSource } from '../source.js';
export { loadText } from './text.js';
export { createShell } from './shell.js';
export { createH } from './h.js';
export { createGrid, compareCells } from './grid.js';
export { createHtmlFrame } from './htmlFrame.js';
export { applyTheme } from './theme.js';
export { themeVars, lightTheme, darkTheme } from '../theme.js';
export { clearMarks, markIn } from '../mark.js';
export { bestMatch, isIgnored, scoreMatch, squash } from '../match.js';
export { prepareHtml } from '../prepareHtml.js';
