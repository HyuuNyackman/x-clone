const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/*',
      'playwright-report/*',
      'test-results/*',
      '.expo/*',
      'node_modules/*',
      'apm_modules/*',
      '.apm/*',
      '.claude/skills/*',
    ],
  },
]);
