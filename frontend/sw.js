const CACHE_NAME = 'inventariohub-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/views/login.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/js/api.js',
  '/js/utils.js',
  '/js/unidades.js',
  '/js/theme.js',
  '/js/auth.js',
  '/js/app.js',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(PRECACHE).catch(function (err) {
      console.warn('[SW] Precache parcial:', err);
    });
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  if (url.origin !== location.origin) return;

  // API: network-first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var clone = res.clone();
        if (res.ok && e.request.method === 'GET') {
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
        }
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }

  var isNavigation = e.request.mode === 'navigate';
  var isDynamicAsset = /\.(html|js|css)$/.test(url.pathname);

  // HTML/JS/CSS y navegaciones: network-first para no servir versiones viejas en F5
  if (isNavigation || isDynamicAsset) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || (isNavigation ? caches.match('/index.html') : undefined);
        });
      })
    );
    return;
  }

  // Assets estáticos: cache-first
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        if (isNavigation) return caches.match('/index.html');
      });
    })
  );
});
