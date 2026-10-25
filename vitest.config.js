import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package owns its test environment in its own vite.config.js.
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{js,jsx}'],
      exclude: ['**/*.test.{js,jsx}', '**/*.d.ts'],
      // Set the minimum per repository.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
