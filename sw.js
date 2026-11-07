const CACHE_PREFIX = 'planejamento-espiritual-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v10-cards';
const CONTENT_KEY = '/data/content.json';
const SHELL = ['/', '/index.html', '/reader.css?v=2', '/reader.js?v=2', '/manifest.webmanifest', '/icons/favicon-3d.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    try {
      const response = await fetch(CONTENT_KEY, { cache: 'no-store' });
      if (response.ok && (await response.clone().json()).daily) await cache.put(CONTENT_KEY, response);
    } catch {
      // Keep the most recent cached readings if the device is offline.
      for (const name of (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)) {
        const previous = await (await caches.open(name)).match(CONTENT_KEY);
        if (previous) { await cache.put(CONTENT_KEY, previous); break; }
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isContent = url.pathname === CONTENT_KEY;
  const isNavigation = event.request.mode === 'navigate';
  if (!isContent && !isNavigation && !SHELL.includes(url.pathname + url.search)) return;
  const cacheKey = isContent ? CONTENT_KEY : isNavigation ? '/' : event.request;
  event.respondWith((async () => {
    let response;
    try {
      response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheKey, response.clone()).catch(() => {});
        return response;
      }
    } catch { /* Use the offline cache when available. */ }
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    return (await cache?.match(cacheKey)) || response || Response.error();
  })());
});
