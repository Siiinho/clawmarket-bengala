import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { buscarJornalOficial } from './server/jornalOficial.js'
import { responderEanImages } from './server/eanImages.js'
import { middlewareEncarte } from './server/encarteServidor.js'

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

// /api/eanimages no PC da loja: funciona em `npm run dev` e em `npm run preview`.
// Mantém a chave da EAN Images fora do navegador na chamada à API.
function eanImagesApi() {
  const middleware = async (req, res) => {
    const { status, corpo } = await responderEanImages(req.originalUrl || req.url)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(corpo))
  }
  return {
    name: 'ean-images-api',
    configureServer(server) { server.middlewares.use('/api/eanimages', middleware) },
    configurePreviewServer(server) { server.middlewares.use('/api/eanimages', middleware) },
  }
}

// /api/encarte: o site do encarte que a tag NFC abre. O app publica aqui e todos os
// celulares com o link aberto recebem a versão nova na hora (ver server/encarteServidor.js).
function encarteApi() {
  return {
    name: 'encarte-api',
    configureServer(server) { server.middlewares.use('/api/encarte', middlewareEncarte) },
    configurePreviewServer(server) { server.middlewares.use('/api/encarte', middlewareEncarte) },
  }
}

// base './' lets the production build (dist/index.html) open directly from file://
export default defineConfig(({ mode }) => {
  // Variáveis só do servidor (sem prefixo VITE_): ficam fora do código do navegador.
  const env = loadEnv(mode, process.cwd(), '')
  for (const nome of ['EANIMAGES_API_KEY', 'EANIMAGES_COM_DADOS', 'ENCARTE_TOKEN', 'ENCARTE_DIR']) {
    if (env[nome] && !process.env[nome]) process.env[nome] = env[nome]
  }
  return {
  base: './',
  // host: true deixa o celular do cliente abrir o encarte pelo IP do PC na rede da loja.
  server: { host: true },
  preview: { host: true },
  plugins: [
    react(),
    tailwindcss(),
    jornalOficialApi(),
    eanImagesApi(),
    encarteApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      devOptions: { enabled: true },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
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
  }
})
