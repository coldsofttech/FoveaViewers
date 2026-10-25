import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: { index: 'src/index.js', 'core/index': 'src/core/index.js' },
      formats: ['es'],
    },
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      // React and the viewer packages are peer dependencies and must never be bundled.
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@coldsofttech\/fovea-/],
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
