import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The PDF and Excel readers are large, but they load on demand in chunks of their own.
    chunkSizeWarningLimit: 1000,
  },
});
