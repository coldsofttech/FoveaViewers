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
    // React-free code: the runtime and, later, each viewer's /vanilla controller and /element. It
    // draws into whatever container it is given (possibly a shadow root), so it must not reach for
    // the global document, and it must not import React or anything that does.
    files: [
      'packages/*/src/core/vanilla/**/*.js',
      'packages/*/src/core/element/**/*.js',
      'packages/*/src/vanilla.js',
      'packages/*/src/vanilla/**/*.js',
      'packages/*/src/element.js',
    ],
    ignores: ['**/*.test.js'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'document',
          message:
            'Use container.ownerDocument: the container may be a shadow root, and a global lookup such as document.getElementById cannot see inside one.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@coldsofttech/fovea-viewers', message: 'That is the React entry point.' },
            {
              name: '@coldsofttech/fovea-viewers/core',
              message: 'That is the React core. Use @coldsofttech/fovea-viewers/core/vanilla.',
            },
          ],
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'This code must not use React.',
            },
            {
              group: ['**/*.jsx', '**/useSource.js', '**/useText.js', '**/useLatest.js'],
              message: 'React-only module.',
            },
          ],
        },
      ],
    },
  },
  {
    // Test helpers and tests of the build scripts: they write fixtures to temporary folders and
    // index objects by test-owned keys.
    files: ['test-support/**', 'scripts/**/*.test.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      'no-unsanitized/method': 'off',
    },
  },
  {
    // Throwaway spike runners: they build into `.temp/` and import a config by path.
    files: ['docs/design/spikes/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'security/detect-non-literal-fs-filename': 'off', 'no-unsanitized/method': 'off' },
  },
];
