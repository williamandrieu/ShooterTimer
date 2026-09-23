import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'dev-dist/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2023 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'test', pattern: 'src/test/**' },
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'application', pattern: 'src/application/**' },
        { type: 'ports', pattern: 'src/ports/**' },
        { type: 'infra', pattern: 'src/infra/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'hooks', pattern: 'src/hooks/**' },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'validation', pattern: 'src/validation/**' },
        { type: 'i18n', pattern: 'src/i18n/**' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'ports'] } } } },
            },
            {
              from: { element: { type: 'application' } },
              allow: {
                to: { element: { types: { anyOf: ['application', 'domain', 'ports', 'validation'] } } },
              },
            },
            {
              from: { element: { type: 'ports' } },
              allow: { to: { element: { types: { anyOf: ['ports', 'domain'] } } } },
            },
            {
              from: { element: { type: 'validation' } },
              allow: { to: { element: { types: { anyOf: ['validation', 'domain'] } } } },
            },
            {
              from: { element: { type: 'infra' } },
              allow: {
                to: { element: { types: { anyOf: ['infra', 'domain', 'ports', 'validation'] } } },
              },
            },
            {
              from: { element: { type: 'hooks' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['hooks', 'application', 'domain', 'ports', 'validation', 'app', 'i18n'] },
                  },
                },
              },
            },
            {
              from: { element: { type: 'ui' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['ui', 'hooks', 'app', 'domain', 'validation', 'i18n', 'ports'] } },
                },
              },
            },
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: ['app', 'ui', 'hooks', 'application', 'domain', 'ports', 'infra', 'validation', 'i18n'],
                    },
                  },
                },
              },
            },
            {
              from: { element: { type: 'i18n' } },
              allow: { to: { element: { types: { anyOf: ['i18n', 'domain'] } } } },
            },
            {
              from: { element: { type: 'test' } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        'test',
                        'domain',
                        'application',
                        'ports',
                        'infra',
                        'validation',
                        'hooks',
                        'app',
                        'i18n',
                        'ui',
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**'],
    rules: {
      'boundaries/dependencies': 'off',
    },
  },
);
