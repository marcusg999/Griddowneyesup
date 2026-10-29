import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // Budget enforced separately by scripts/check-budget.ts; this just stops
    // Vite warning about chunks that are within our budget anyway.
    chunkSizeWarningLimit: 300,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Ballast',
        short_name: 'Ballast',
        description:
          'What is happening near you, what to do in the next hour, and what to buy before the shelves empty. Works with the radio off.',
        theme_color: '#0b0e11',
        background_color: '#0b0e11',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The content pack is precached with the shell. This is the mechanism
        // that makes the library available before the user has ever needed it
        // (§2), rather than caching it opportunistically after first view.
        globPatterns: ['**/*.{js,css,html,svg,png,json,sig}'],
        globDirectory: 'dist',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Threat snapshot: network first, but hard time-boxed, and the
            // cache always answers if the network does not. Never a spinner.
            urlPattern: /\/snapshot\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'threat-snapshot',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});
