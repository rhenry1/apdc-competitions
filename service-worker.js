// APDC Competitions — Service Worker
//
// Precaches the full app shell — the hub, both competition pages (schedule
// data is embedded in them), and every shared asset — so the whole site works
// offline after the first visit. Runtime strategy stays network-first: always
// fresh when online, cache fallback when offline.
const CACHE = 'apdc-v3';

// Derive the base path from the registration scope instead of hardcoding it,
// so the same worker functions on GitHub Pages (/apdc-competitions) and on any
// other origin root (local dev/test servers). The old hardcoded base made
// cache.addAll 404 outside production, which silently failed install — and
// with it, all offline support.
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/nationals-2026/',
  BASE + '/nationals-2026/index.html',
  BASE + '/regionals-spring-2027/',
  BASE + '/regionals-spring-2027/index.html',
  BASE + '/manifest.json',
  BASE + '/favicon.ico',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  BASE + '/assets/tokens.css',
  BASE + '/assets/schedule-theme.css',
  BASE + '/assets/schedule-engine.js',
  BASE + '/assets/competitions.js',
  BASE + '/assets/icons.js',
  BASE + '/assets/pwa.js',
  BASE + '/assets/pwa.css'
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

// Network-first: always fresh when online, cache fallback when offline.
// Only same-origin GETs are handled — cross-origin requests (fonts, the
// external livestream) go straight to the network, and non-GETs can't be
// cached at all.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return response;
      })
      .catch(() => {
        // Deep links carry query params (?routine=…, ?day=…) that the precache
        // keys don't have — ignore the search string for page navigations so a
        // shared link still opens offline.
        const nav = req.mode === 'navigate';
        return caches.match(req, { ignoreSearch: nav }).then(hit =>
          hit || (nav ? caches.match(BASE + '/index.html') : undefined)
        );
      })
  );
});
