import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string
}

export default defineConfig({
  base: '/agora/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Agora',
        short_name: 'Agora',
        description: 'Propose, vote and split the cost — the board your group decides in.',
        theme_color: '#EBEDE7',
        background_color: '#EBEDE7',
        display: 'standalone',
        start_url: '/agora/',
        scope: '/agora/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // woff2 is not in Workbox's default glob, and without it the self-hosted faces would not be
        // precached — the app would open offline with system fonts.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: '/agora/index.html',
        // The board is cached by CachingBoardRepository (IndexedDB, version-gated), not here:
        // a service-worker cache of the REST calls would fetch payloads the version gate avoids.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: { sourcemap: true, target: 'es2022' },
})
