import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { buscarJornalOficial } from './server/jornalOficial.js'

// Middleware de dev: expõe /api/jornal-oficial rodando no servidor (sem CORS).
// Em produção, a mesma lógica vive em api/jornal-oficial.js (função serverless).
function jornalOficialApi() {
  return {
    name: 'jornal-oficial-api',
    configureServer(server) {
      server.middlewares.use('/api/jornal-oficial', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Access-Control-Allow-Origin', '*')
        try {
          res.end(JSON.stringify(await buscarJornalOficial()))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(e?.message || e) }))
        }
      })
    },
  }
}

// base './' lets the production build (dist/index.html) open directly from file://
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    jornalOficialApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      devOptions: { enabled: true },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              (/\/templates\//.test(url.pathname) || /\.(?:png|jpe?g|webp|svg)$/i.test(url.pathname)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'clawmarket-imagens-v1',
              expiration: { maxEntries: 180, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('/api/jornal-oficial'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'clawmarket-api-v1',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 8, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: './',
        name: 'ClawMarket — Gestão de ofertas e validade',
        short_name: 'ClawMarket',
        description: 'Gestão de validade e ofertas para supermercados',
        lang: 'pt-BR',
        theme_color: '#7a241b',
        background_color: '#fbf6ee',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
