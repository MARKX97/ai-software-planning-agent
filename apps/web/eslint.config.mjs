// ESLint config for apps/web — root base + Next.js plugin.
import rootConfig from '../../eslint.config.mjs';
import nextPlugin from '@next/eslint-plugin-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
];
