import nkzw from '@nkzw/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  env: {
    browser: true,
    builtin: true,
    es2024: true,
  },
  extends: [nkzw],
  ignorePatterns: ['docs/**'],
  overrides: [
    {
      env: {
        browser: false,
        node: true,
      },
      files: ['scripts/**'],
      rules: {
        'no-console': 'off', // CLI scripts report to stdout
      },
    },
  ],
  rules: {
    'no-console': ['error', { allow: ['error', 'warn'] }],
    // Field order is meaningful here: tMin/tMean/tMax, the model's steps, the
    // parameter groups. Alphabetical order would scramble it.
    'perfectionist/sort-interfaces': 'off',
    'perfectionist/sort-object-types': 'off',
    'perfectionist/sort-objects': 'off',
  },
});
