import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package owns its test environment in its own vite.config.js.
    projects: [
      'packages/*',
      // The repository's own build scripts (plain Node, no DOM).
      { test: { name: 'scripts', include: ['scripts/**/*.test.js'], environment: 'node' } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{js,jsx}'],
      exclude: ['**/*.test.{js,jsx}', '**/*.d.ts'],
      // Set the minimum per repository.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
