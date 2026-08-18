import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'scripts/*.mjs'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // ---- Hexagonal boundaries -------------------------------------------------------------
  // The dependency rule, enforced instead of documented: the domain knows nobody, the
  // application knows only ports, adapters know nothing about the UI, and the UI receives its
  // adapters by injection. A violation is a lint error, not a review comment.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/application/*', '@/infrastructure/*', '@/presentation/*'], message: 'The domain depends on nothing. Move the dependency behind a port.' },
            { group: ['react', 'react-dom', 'react-*', '@supabase/*', 'i18next', 'idb'], message: 'The domain is framework-free TypeScript.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/infrastructure/*', '@/presentation/*'], message: 'Use cases talk to ports, never to adapters.' },
            { group: ['react', 'react-dom', 'react-*', '@supabase/*'], message: 'Use cases are framework-free.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/presentation/*'], message: 'An adapter must not reach into the UI.' }] },
      ],
    },
  },
  {
    // The composition root is the one place allowed to wire adapters: src/shared/di and main.tsx.
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/infrastructure/*'], message: 'Components receive adapters by injection. Wire them in src/shared/di.' },
          ],
        },
      ],
    },
  },
  prettier,
)
