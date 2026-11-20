import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import cssModule from '../../scripts/vite-plugin-css-module.js';

export default defineConfig({
  plugins: [react(), cssModule()],
  build: {
    lib: {
      entry: {
        index: 'src/index.js',
        'vanilla/index': 'src/vanilla/index.js',
        element: 'src/element.js',
      },
      formats: ['es'],
    },
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      // React and the shared fovea-viewers package are peer dependencies and must never be bundled.
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@coldsofttech\/fovea-viewers($|\/)/],
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
    // Tests use the shared package's source, so they do not need it built first.
    // The more specific paths come first, or `/core` would also match `/core/vanilla`.
    alias: {
      '@coldsofttech/fovea-viewers/core/vanilla': fileURLToPath(
        new URL('../fovea-viewers/src/core/vanilla/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-viewers/core/element': fileURLToPath(
        new URL('../fovea-viewers/src/core/element/index.js', import.meta.url),
      ),
      '@coldsofttech/fovea-viewers/core': fileURLToPath(
        new URL('../fovea-viewers/src/core/index.js', import.meta.url),
      ),
    },
    setupFiles: ['../../vitest.setup.js'],
  },
});
