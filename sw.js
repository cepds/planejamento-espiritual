const CACHE_PREFIX = 'planejamento-espiritual-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const CONTENT_CACHE_KEY = '/data/content.json';
const SHELL = ['/', '/index.html', '/styles.css', '/panel.css?v=20260922-1', '/app.js?v=20260922-1', '/manifest.webmanifest', '/icons/favicon-3d.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isContent = url.pathname === CONTENT_CACHE_KEY;
  const isNavigation = event.request.mode === 'navigate';
  if (!isContent && !isNavigation && !SHELL.includes(url.pathname + url.search)) return;
  const cacheKey = isContent ? CONTENT_CACHE_KEY : isNavigation ? '/' : event.request;
  event.respondWith((async () => {
    let response;
    try {
      response = await fetch(event.request);
      if (response.ok) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(cacheKey, response.clone());
        } catch { /* O conteúdo online continua disponível se o armazenamento falhar. */ }
        return response;
      }
    } catch { /* Tenta a última cópia válida. */ }
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    const cached = await cache?.match(cacheKey).catch(() => null);
    return cached || response || Response.error();
  })());
});
