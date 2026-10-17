// Offline cache. A new build changes the version, which replaces the old cache.
const CACHE = 'azhar-202610171425';
const FILES = ["./","index.html","manifest.webmanifest","js/audio.js","js/body.js","js/combat.js","js/data.js","js/figure.js","js/frames.js","js/input.js","js/levels.js","js/main.js","js/player.js","js/render.js","js/scene.js","js/world.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('azhar-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first so a new version shows up at once; the cache is the offline fallback
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});
