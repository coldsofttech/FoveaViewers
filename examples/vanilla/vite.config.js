import { defineConfig } from 'vite';

// The same sample files as the React demo.
export default defineConfig({
  publicDir: '../demo/public',
  // The PDF and Excel readers are large, but they load on demand in chunks of their own.
  build: { chunkSizeWarningLimit: 1000 },
});
