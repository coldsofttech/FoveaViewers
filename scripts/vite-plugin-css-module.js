// A Vite plugin for the viewer packages' library builds. It makes the package's CSS available to
// its Web Component as a JavaScript string.
//
// A page's stylesheet does not reach a shadow root, so a viewer's Web Component (`/element`) cannot
// rely on the user importing `style.css`. It imports `./style.css.js` instead and adopts the text
// into its shadow root, so nobody has to import a stylesheet.
//
// The package has a stub `src/style.css.js` (`export default '';`) so the source, its tests and its
// types all work. In a build, the plugin swaps the stub's export for a placeholder and, once Vite
// has written `style.css`, puts the real CSS text in its place. See
// docs/design/vanilla-and-element.md.

const PLACEHOLDER = '__FOVEA_CSS_PLACEHOLDER__';

/**
 * @param {{ source?: string, stub?: string }} [options] The CSS asset to read (`style.css`) and
 *   the name of the stub module (`style.css.js`).
 * @returns {import('vite').Plugin}
 */
export default function cssModule({ source = 'style.css', stub = 'style.css.js' } = {}) {
  let building = false;
  return {
    name: 'fovea-css-module',
    // Vite writes style.css in its own generateBundle step. This has to run after it.
    enforce: 'post',
    configResolved(config) {
      building = config.command === 'build';
    },
    transform(_code, id) {
      if (!building || !id.split('?')[0].endsWith(`/${stub}`)) return null;
      return { code: `export default ${JSON.stringify(PLACEHOLDER)};\n`, map: null };
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        // eslint-disable-next-line security/detect-object-injection -- `source` is the plugin's own option.
        const css = bundle[source];
        if (css?.type !== 'asset') {
          this.error(`fovea-css-module: no "${source}" in the bundle to turn into a module.`);
          return;
        }
        const text = JSON.stringify(String(css.source));
        const quoted = new RegExp(`(["'\`])${PLACEHOLDER}\\1`, 'g');
        let replaced = 0;
        for (const file of Object.values(bundle)) {
          if (file.type !== 'chunk' || !file.code.includes(PLACEHOLDER)) continue;
          file.code = file.code.replace(quoted, () => {
            replaced++;
            return text;
          });
        }
        if (replaced === 0) {
          this.error(
            `fovea-css-module: nothing imports "${stub}", so there is nowhere to put the CSS.`,
          );
        }
      },
    },
  };
}
