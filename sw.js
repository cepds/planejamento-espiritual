const CACHE_NAME = 'planejamento-espiritual-shell-v2';
const CONTENT_CACHE_KEY = '/data/content.json';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = url.pathname === CONTENT_CACHE_KEY ? CONTENT_CACHE_KEY : event.request;
      cache.put(cacheKey, response.clone());
      return response;
    } catch {
      const cacheKey = url.pathname === CONTENT_CACHE_KEY ? CONTENT_CACHE_KEY : event.request;
      const cached = await caches.match(cacheKey);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('/');
      return Response.error();
    }
  })());
});
