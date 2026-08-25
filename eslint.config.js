// eslint.config.js
const tseslint = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');
const prettierConfig = require('eslint-config-prettier');
const nPlugin = require('eslint-plugin-n');

module.exports = [
  // TypeScript plugin
  {
    files: ['*.ts'],
    languageOptions: {
      parser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
  // Other file types (JS/other)
  {
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      n: nPlugin,
    },
    rules: {
      // N plugin rules
      'n/no-deprecated-api': 'error',
      'n/no-exports-assign': 'error',
      'n/no-extraneous-import': 'error',
      'n/no-extraneous-require': 'error',
      'n/no-missing-import': 'error',
      'n/no-missing-require': 'error',
      'n/no-process-exit': 'error',
      'n/no-unpublished-import': 'error',
      'n/no-unpublished-require': 'error',
      // Prettier (disables conflicting rules)
      ...prettierConfig.rules,
      // Custom rules
      quotes: ['error', 'double'],
      'unicorn/prefer-null': 'off',
    },
  },
];
