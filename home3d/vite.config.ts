/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // PORT : injecté par les outils de preview ; défaut Vite (5173) sinon.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : {},
  // Tests unitaires purs (vitest), colocalisés avec les modules. Environnement
  // node : la lib testée ne touche pas au DOM.
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'script/**/*.test.mjs'],
    environment: 'node',
  },
})
