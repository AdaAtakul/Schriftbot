// Bei jeder Änderung an den Dateien VERSION hochzählen, sonst sieht das iPad die alte Version.
const VERSION = 'v26';
const CACHE = 'handschrift-' + VERSION;
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/blatt.js',
  'js/blattui.js',
  'js/pdfimport.js',
  'js/paper.js',
  'js/stil.js',
  'js/profilwahl.js',
  'js/sammlung.js',
  'js/claude.js',
  'js/einfuegen.js',
  'js/aufnahme.js',
  'js/export.js',
  'js/goodnotes.js',
  'js/ghost.js',
  'js/ink.js',
  'js/pen.js',
  'js/textaufnahme.js',
  'js/textplan.js',
  'js/layout.js',
  'js/render.js',
  'js/schreiben.js',
  'js/profil.js',
  'js/profile.js',
  'js/storage.js',
  'vendor/perfect-freehand.mjs',
  'vendor/jspdf.umd.min.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'vendor/pdfjs/standard_fonts/FoxitDingbats.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixed.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixedBold.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixedItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerif.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerifBold.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerifItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSymbol.pfb',
  'vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-Italic.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' am Browser-Cache vorbei: GitHub Pages lässt Dateien 10 Minuten cachen,
  // sonst landet in der neuen Version womöglich der alte Code.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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
