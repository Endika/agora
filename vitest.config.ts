import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  // The footer reads the version Vite injects at build time; tests need it defined too.
  define: { __APP_VERSION__: JSON.stringify('test') },
  plugins: [react()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: { reporter: ['text', 'html'], exclude: ['**/*.d.ts', 'src/main.tsx'] },
  },
})
