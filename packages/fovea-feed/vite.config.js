import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
    },
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      // React and the shared fovea-viewers package are peer dependencies and must never be bundled.
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        /^@coldsofttech\/fovea-viewers($|\/)/,
        /^dompurify($|\/)/,
      ],
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
    alias: {
      '@coldsofttech/fovea-viewers/core': fileURLToPath(
        new URL('../fovea-viewers/src/core/index.js', import.meta.url),
      ),
    },
    setupFiles: ['../../vitest.setup.js'],
  },
});
