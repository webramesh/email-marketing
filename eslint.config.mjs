import { eslintrc } from '@eslint/eslintrc';
import nextPlugin from 'eslint-config-next';

const { FlatCompat } = eslintrc;
const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals'),
  ...nextPlugin,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
    ignores: ['**/.next/**', '**/node_modules/**'],
  },
];