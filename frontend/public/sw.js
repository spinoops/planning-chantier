/* Service worker « hors ligne léger » :
 *  - l'application (coquille) est mise en cache au premier chargement ;
 *  - les lectures d'API du planning (planning, heures, chantiers, équipes, absences,
 *    réglages, utilisateur) sont servies « réseau d'abord, cache sinon » :
 *    sur un chantier sans réseau, la dernière version consultée reste lisible ;
 *  - les écritures passent toujours par le réseau (file d'attente côté app : lib/offlineQueue).
 */
const VERSION = 'pc-v1'
const SHELL = `${VERSION}-shell`
const API = `${VERSION}-api`
const API_PATHS = ['/api/planning', '/api/heures', '/api/chantiers', '/api/equipes', '/api/absences', '/api/settings', '/api/user', '/api/workers', '/api/signalements']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Lectures d'API : réseau d'abord, cache en secours (clé = URL complète, token non inclus → même utilisateur sur l'appareil).
  if (API_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(API).then((cache) => cache.put(request, response.clone()))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached ?? new Response(JSON.stringify({ message: 'Hors ligne', data: [] }), { status: 503, headers: { 'Content-Type': 'application/json' } }))),
    )
    return
  }

  // Navigation et fichiers de l'app (même origine) : cache d'abord pour les fichiers versionnés, réseau pour le reste.
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
      return
    }
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ??
            fetch(request).then((response) => {
              if (response.ok) caches.open(SHELL).then((cache) => cache.put(request, response.clone()))
              return response
            }),
        ),
      )
    }
  }
})
