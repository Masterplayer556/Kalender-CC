/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Pfad, unter dem die App läuft. Lokal: http://localhost:5173/kalender-tracker/
// Auf GitHub Pages (https://<name>.github.io/<repo>/) setzt der Workflow den Pfad beim Bauen
// automatisch auf den Repository-Namen (npm run build -- --base=/<repo>/).
const BASE = '/kalender-tracker/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Neue Versionen der App werden automatisch im Hintergrund geladen.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kalender-Tracker',
        short_name: 'Kalender',
        description: 'Tests, Aufgaben und Lernzeiten im Blick',
        lang: 'de',
        display: 'standalone',
        orientation: 'any',
        // start_url und scope übernimmt das Plugin automatisch vom Pfad (base)
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alle App-Dateien zwischenspeichern, damit die App auch offline startet.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    // Tests laufen in einer festen Zeitzone, damit Sommer-/Winterzeit-Tests reproduzierbar sind.
    env: { TZ: 'Europe/Zurich' },
    include: ['tests/**/*.test.ts'],
  },
})
