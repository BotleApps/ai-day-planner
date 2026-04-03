// AI Day Planner — Service Worker
// Cache-first for static assets, network-first for API/navigation.

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `aip-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `aip-runtime-${CACHE_VERSION}`;

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install ─────────────────────────────────────────────────────────────────
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
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and API requests (always network for those)
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Next.js static assets (_next/static) — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
    return;
  }

  // Public static files (icons, manifest) — cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
    return;
  }

  // Navigation (HTML pages) — network-first with offline fallback to cached '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
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
