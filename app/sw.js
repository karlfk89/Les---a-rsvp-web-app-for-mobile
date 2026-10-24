// Service worker: caches the whole app on install so it opens and imports
// books without a network connection (flymodus). Books themselves live in
// IndexedDB, not in this cache. The file list and version below are generated
// by `npm run precache`.

// <precache>
const VERSION = '3b1f8cdbdf';
const FILES = [
  './',
  './css/app.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/import/decode.js',
  './js/import/epub.js',
  './js/import/html.js',
  './js/import/index.js',
  './js/import/pdf.js',
  './js/import/structure.js',
  './js/import/txt.js',
  './js/main.js',
  './js/reader/book-index.js',
  './js/reader/engine.js',
  './js/reader/orp.js',
  './js/reader/pacing.js',
  './js/settings.js',
  './js/storage/backup.js',
  './js/storage/db.js',
  './js/text/abbreviations.js',
  './js/text/chars.js',
  './js/text/compound-words.js',
  './js/text/compound.js',
  './js/text/hyphenate.js',
  './js/text/language.js',
  './js/text/normalize.js',
  './js/text/tokenize.js',
  './js/ui/backup-view.js',
  './js/ui/controls.js',
  './js/ui/dom.js',
  './js/ui/format.js',
  './js/ui/gestures.js',
  './js/ui/library.js',
  './js/ui/offline.js',
  './js/ui/reader.js',
  './js/ui/settings-view.js',
  './js/version.js',
  './manifest.webmanifest',
  './vendor/fflate.js',
  './vendor/hyphenation/en.js',
  './vendor/hyphenation/no.js',
  './vendor/pdfjs/pdf.min.mjs',
  './vendor/pdfjs/pdf.worker.min.mjs',
];
// </precache>

const CACHE = `les-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('les-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      return (await cache.match('./')) || fetch(request);
    }
    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || fetch(request);
  })());
});
