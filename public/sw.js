// SortedPlan — Service Worker v3
// Static assets: cache-first. Data APIs: network-first with offline fallback.

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `aip-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `aip-runtime-${CACHE_VERSION}`;
const DATA_CACHE = `aip-data-${CACHE_VERSION}`;

// Routes whose GET responses are cached for offline use
const DATA_ROUTES = ['/api/plans', '/api/checklists'];

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Data API routes (plans, checklists) — network-first, stale fallback when offline
  if (DATA_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(
                JSON.stringify({ plans: [], checklists: [], _offline: true }),
                { headers: { 'Content-Type': 'application/json' } }
              )
          )
        )
    );
    return;
  }

  // Skip remaining API routes — always network, no caching
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Next.js static chunks — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          })
      )
    );
    return;
  }

  // Icons and manifest — cache-first
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          })
      )
    );
    return;
  }

  // Navigation (HTML) — network-first, fall back to cached '/'
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached || fetchPromise;
      })
    )
  );
});
