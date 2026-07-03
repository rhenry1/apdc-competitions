// APDC Nationals 2026 — Service Worker
const CACHE = 'apdc-2026-v4';
const BASE  = '/dance-nationals-2026';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/favicon.ico',
  BASE + '/favicon.svg',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: always try network, fall back to cache
// This means users always get fresh content when online
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache the fresh response
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
