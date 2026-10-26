const CACHE_PREFIX = 'planejamento-espiritual-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v8`;
const CONTENT_CACHE_KEY = '/data/content.json';
const SHELL = ['/', '/index.html', '/styles.css', '/panel.css?v=20261001-4', '/app.js?v=20261026-1', '/workspace.css?v=20261026-1', '/study-state.js?v=20261001-4', '/workspace.js?v=20261026-1', '/backup.js?v=20261026-1', '/manifest.webmanifest', '/icons/favicon-3d.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    // O download do conteúdo independe de o Service Worker já controlar a primeira página.
    let available = false;
    try {
      const response = await fetch(CONTENT_CACHE_KEY, { cache: 'no-store' });
      if (response.ok && (await response.clone().json()).daily?.date) {
        await cache.put(CONTENT_CACHE_KEY, response);
        available = true;
      }
    } catch { /* Um erro externo não deve impedir a instalação do app. */ }
    if (!available) {
      // Não descartar a última leitura válida ao atualizar o aplicativo sem conexão.
      try {
        const oldNames = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
        for (const name of oldNames) {
          const old = await (await caches.open(name)).match(CONTENT_CACHE_KEY);
          if (old) { await cache.put(CONTENT_CACHE_KEY, old); break; }
        }
      } catch { /* Modo offline depende de armazenamento disponível. */ }
    }
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
