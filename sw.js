// Bei jeder Änderung an den Dateien VERSION hochzählen, sonst sieht das iPad die alte Version.
const VERSION = 'v8';
const CACHE = 'handschrift-' + VERSION;
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/aufnahme.js',
  'js/export.js',
  'js/ink.js',
  'js/layout.js',
  'js/render.js',
  'js/schreiben.js',
  'js/profil.js',
  'js/profile.js',
  'js/storage.js',
  'vendor/perfect-freehand.mjs',
  'vendor/jspdf.umd.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache zuerst, damit die App offline sofort startet.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
