import { copyFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

/**
 * GitHub Pages serves a project site from a subpath, not the domain root.
 * Everything that resolves an absolute URL — the content pack, the fonts, the
 * router, the service worker scope — has to agree on that prefix, so it comes
 * from one place.
 *
 * Empty for local dev and preview, which is also what the offline suite runs
 * against.
 */
const base = process.env['PUBLIC_BASE_PATH'] ?? '/';

/**
 * GitHub Pages has no history fallback: a static host asked for
 * `/skills/boil-water` looks for that file and, not finding it, serves
 * `404.html`. Shipping a copy of the shell under that name is what makes a
 * deep link — a shared skill, a bookmarked sheet — load on first visit, before
 * any service worker exists to answer for it.
 *
 * Runs after the PWA plugin so it copies the finished document, with the
 * service worker registration already injected.
 */
function spaFallback(): Plugin {
  return {
    name: 'ballast:spa-fallback',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const dir = fileURLToPath(new URL('./dist', import.meta.url));
      await copyFile(`${dir}/index.html`, `${dir}/404.html`);
    },
  };
}

export default defineConfig({
  base,
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
        id: base,
        scope: base,
        description:
          'What is happening near you, what to do in the next hour, and what to buy before the shelves empty. Works with the radio off.',
        theme_color: '#0b0e11',
        background_color: '#0b0e11',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
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
        // woff2 included deliberately: the faces are self-hosted and must be
        // precached, or the first offline render falls back to system type.
        globPatterns: ['**/*.{js,css,html,svg,png,json,sig,woff2}'],
        globDirectory: 'dist',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
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
    } satisfies Partial<VitePWAOptions>),
    spaFallback(),
  ],
});
