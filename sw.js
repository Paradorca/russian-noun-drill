const CACHE_NAME = 'russian-noun-drill-v17';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './diagnostic.js',
  './map.js',
  './practice.js',
  './chat.js',
  './settings.js',
  './texts.js',
  './grammar-data.json',
  './sentences-data.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
