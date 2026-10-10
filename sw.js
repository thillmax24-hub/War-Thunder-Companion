const CACHE = 'wt-companion-shell-v1';
const BASE = self.registration.scope;
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      key.startsWith('wt-companion-shell-') && key !== CACHE
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const base = new URL(BASE);

  if (!self.navigator.onLine && (
    url.origin === 'https://wtvehiclesapi.duckdns.org' ||
    url.origin === 'https://raw.githubusercontent.com'
  )) {
    event.respondWith(Promise.resolve(new Response('', {status: 503})));
    return;
  }

  if (url.origin !== base.origin) return;

  const isAppPage = request.mode === 'navigate' && (
    url.pathname === base.pathname ||
    url.pathname === base.pathname + 'index.html'
  );

  if (isAppPage) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error('Page unavailable');
        await cache.put(new URL('index.html', BASE).href, response.clone());
        return response;
      } catch {
        return await cache.match(new URL('index.html', BASE).href)
          || new Response('Offline: Bitte die App zuerst mit Internet öffnen.', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=utf-8'}
          });
      }
    })());
    return;
  }

  if (FILES.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      return cached || fetch(request);
    })());
  }
});
