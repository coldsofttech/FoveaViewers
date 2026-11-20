import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: 'src/index.js',
        'vanilla/index': 'src/vanilla/index.js',
        element: 'src/element.js',
        'core/index': 'src/core/index.js',
        // The React-free runtime that the viewers' /vanilla and /element entries are built from.
        'core/vanilla/index': 'src/core/vanilla/index.js',
        'core/element/index': 'src/core/element/index.js',
      },
      formats: ['es'],
    },
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      // React and the viewer packages are peer dependencies and must never be bundled. DOMPurify is
      // a dependency, left for the app's bundler.
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@coldsofttech\/fovea-/, /^dompurify($|\/)/],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: 'style.css',
      },
    },
  },
  test: {
    environment: 'jsdom',
    // The viewers are used from their source, so the tests do not need them built first. The more
    // specific paths come first, or a shorter one would also match them.
    alias: {
      '@coldsofttech/fovea-viewers/core/vanilla': fileURLToPath(
        new URL('./src/core/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-viewers/core/element': fileURLToPath(
        new URL('./src/core/element/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-viewers/core': fileURLToPath(
        new URL('./src/core/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-excel/vanilla': fileURLToPath(
        new URL('../fovea-excel/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-excel/css': fileURLToPath(
        new URL('../fovea-excel/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-pdf/vanilla': fileURLToPath(
        new URL('../fovea-pdf/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-pdf/css': fileURLToPath(
        new URL('../fovea-pdf/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-powerpoint/vanilla': fileURLToPath(
        new URL('../fovea-powerpoint/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-powerpoint/css': fileURLToPath(
        new URL('../fovea-powerpoint/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-word/vanilla': fileURLToPath(
        new URL('../fovea-word/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-word/css': fileURLToPath(
        new URL('../fovea-word/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-code/vanilla': fileURLToPath(
        new URL('../fovea-code/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-email/vanilla': fileURLToPath(
        new URL('../fovea-email/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-email/css': fileURLToPath(
        new URL('../fovea-email/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-feed/vanilla': fileURLToPath(
        new URL('../fovea-feed/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-feed/css': fileURLToPath(
        new URL('../fovea-feed/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-html/vanilla': fileURLToPath(
        new URL('../fovea-html/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-html/css': fileURLToPath(
        new URL('../fovea-html/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-image/vanilla': fileURLToPath(
        new URL('../fovea-image/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-image/css': fileURLToPath(
        new URL('../fovea-image/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-markdown/vanilla': fileURLToPath(
        new URL('../fovea-markdown/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-markdown/css': fileURLToPath(
        new URL('../fovea-markdown/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-table/vanilla': fileURLToPath(
        new URL('../fovea-table/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-table/css': fileURLToPath(
        new URL('../fovea-table/src/style.css.js', import.meta.url),
      ),
      '@coldsofttech/fovea-text/vanilla': fileURLToPath(
        new URL('../fovea-text/src/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-text/css': fileURLToPath(
        new URL('../fovea-text/src/style.css.js', import.meta.url),
      ),
    },

    setupFiles: ['../../vitest.setup.js'],
  },
});
