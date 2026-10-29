import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

/**
 * Puts pdf.js's worker in dist next to the code that points at it (see src/pdfjs.js), so an app's
 * bundler finds it from there and serves it with the app.
 */
const pdfWorker = {
  name: 'emit-pdf-worker',
  generateBundle(_options, bundle) {
    // The build leaves the address as written but with the comment that kept it from being
    // rewritten. An app's bundler only recognises the plain form, so put that back.
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') {
        file.code = file.code.replace(
          /new URL\(\s*\/\* @vite-ignore \*\/\s*("\.\/pdf\.worker\.min\.mjs"),\s*import\.meta\.url\s*\)/,
          'new URL($1, import.meta.url)',
        );
      }
    }
    const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
    this.emitFile({
      type: 'asset',
      fileName: 'pdf.worker.min.mjs',
      // The path is built from where pdfjs-dist is installed, not from anything a user gives.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      source: readFileSync(join(root, 'build', 'pdf.worker.min.mjs')),
    });
  },
};

export default defineConfig({
  plugins: [react(), pdfWorker],
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
    },
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      // React and the shared fovea-viewers package are peer dependencies and must never be bundled.
      // pdf.js is a dependency, left for the app's bundler so it can be loaded on demand.
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        /^@coldsofttech\/fovea-viewers($|\/)/,
        /^pdfjs-dist($|\/)/,
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.css'))
            ? 'style.css'
            : 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Tests use the shared package's source, so they do not need it built first.
    alias: {
      '@coldsofttech/fovea-viewers/core': fileURLToPath(
        new URL('../fovea-viewers/src/core/index.js', import.meta.url),
      ),
    },
    setupFiles: ['../../vitest.setup.js'],
  },
});
