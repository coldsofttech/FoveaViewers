import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: 'src/index.js',
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
    setupFiles: ['../../vitest.setup.js'],
  },
});
