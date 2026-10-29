import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['smoke.test.jsx'],
    // Vitest picks mammoth's build for Node. An app's bundler picks the browser build (the production
    // build above does), so the tests are pointed at it. Only the tests use this.
    alias: { mammoth: 'mammoth/mammoth.browser.js' },
    // Run the installed packages through Vite, as an app's bundler would, so their browser builds are
    // used instead of the ones for Node.
    server: { deps: { inline: [/@coldsofttech/, 'exceljs', 'mammoth', 'jszip', 'pdfjs-dist'] } },
  },
});
