import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Lint config. ESLint 9 flat config.
 *
 * The project had a `lint` script and neither a config nor the tool installed,
 * so nothing had ever been linted. This is deliberately not a style engine:
 * the compiler already enforces most of what a style rule would, with
 * noUnusedLocals, noUncheckedIndexedAccess and strict on. What is left is the
 * set of mistakes a type checker cannot see.
 *
 * Which is why the type-aware rules are on. In an offline-first app that lives
 * on promises, a floating promise is a write that silently never happened —
 * and the failure mode is a user whose inventory did not save, discovered on
 * the day it matters. That is worth the slower lint.
 */

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      // Build products, not source.
      'public/content',
      'public/snapshot',
      'src/content/signing-key.generated.ts',
      'test-results',
      'playwright-report',
      '.audit',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Type-aware rules, for the mistakes that only the type graph reveals.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      // An unused argument named with a leading underscore is a deliberate
      // signature match, not an oversight.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // The app.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Off, deliberately. Every file it flagged colocates a context provider
      // with the hook that reads it, which is the conventional React shape and
      // the one that keeps the context private. The rule is about Vite's
      // fast-refresh ergonomics in dev, and splitting four files to smooth a
      // development nicety is the tail wagging the dog.
      'react-refresh/only-export-components': 'off',
      // console.error is used deliberately on the verification paths, where
      // the user cannot act and the developer needs to know. Anything chattier
      // than that is debugging left behind.
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },

  // Build-time code. These scripts talk to the operator through stdout, so the
  // console rule would be backwards here.
  {
    files: ['scripts/**/*.ts', '*.config.ts', '*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Tests. Playwright specs run in Node but carry browser code inside
  // page.evaluate, so they get both.
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
