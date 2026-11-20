import js from '@eslint/js';
import globals from 'globals';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import security from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.temp/**',
      'examples/demo/public/**',
    ],
  },
  js.configs.recommended,
  // Flags DOM XSS sinks such as innerHTML and insertAdjacentHTML, and common unsafe patterns.
  noUnsanitized.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.jsx', 'packages/*/src/**/*.js'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    files: ['*.config.js', '**/vite.config.js', 'scripts/**/*.js', 'vitest.setup.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Throwaway spike runners: they build into `.temp/` and import a config by path.
    files: ['docs/design/spikes/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'security/detect-non-literal-fs-filename': 'off', 'no-unsanitized/method': 'off' },
  },
];
