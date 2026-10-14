import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/t9-simulator/',
  // Both offline dictionaries are deliberately bundled (about 216 KB gzip).
  build: { chunkSizeWarningLimit: 650 },
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icons/*.png', 'icons/*.svg', 'licenses/*.txt'],
    manifest: {
      id: '/t9-simulator/',
      name: 'T9 Simulator — Ein Tastendruck zurück',
      short_name: 'T9 Simulator',
      description: 'Ein Retro-Handy mit Mehrfachdrücken und T9. Vollständig offline.',
      lang: 'de',
      start_url: '/t9-simulator/',
      scope: '/t9-simulator/',
      display: 'standalone',
      background_color: '#f4f2eb',
      theme_color: '#28384a',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      clientsClaim: true,
      globPatterns: ['**/*.{js,css,html,json,svg,png,txt,webmanifest}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 3_000_000
    }
  })]
});
