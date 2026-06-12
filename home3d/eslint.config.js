import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // public/draco et public/basis : décodeurs vendor copiés depuis three
  globalIgnores(['dist', 'public/draco', 'public/basis']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Le pipeline GLB tourne sous Node, pas dans le navigateur
  {
    files: ['script/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
])
