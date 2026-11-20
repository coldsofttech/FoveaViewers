// A Vite plugin for the viewer packages' library builds. Next to `style.css` it emits
// `style.css.js`, a module whose default export is the CSS text.
//
// A page's stylesheet does not reach a shadow root, so a viewer's Web Component (`/element`) cannot
// rely on the user importing `style.css`. It imports this module instead and adopts the text into
// its shadow root, so nobody has to import a stylesheet. See docs/design/vanilla-and-element.md.

/**
 * @param {{ source?: string, output?: string }} [options] The CSS asset to read (`style.css`) and
 *   the module to write (`style.css.js`).
 * @returns {import('vite').Plugin}
 */
export default function emitCssModule({ source = 'style.css', output = 'style.css.js' } = {}) {
  return {
    name: 'fovea-emit-css-module',
    // Vite writes style.css in its own generateBundle step. This has to run after it.
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        // eslint-disable-next-line security/detect-object-injection -- `source` is the plugin's own option.
        const css = bundle[source];
        if (css?.type !== 'asset') {
          this.error(`fovea-emit-css-module: no "${source}" in the bundle to turn into a module.`);
          return;
        }
        this.emitFile({
          type: 'asset',
          fileName: output,
          source: `export default ${JSON.stringify(String(css.source))};\n`,
        });
      },
    },
  };
}
