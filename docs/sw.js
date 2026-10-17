// Offline cache. A new build changes the version, which replaces the old cache.
const CACHE = 'azhar-202610171216';
const FILES = ["./","index.html","manifest.webmanifest","js/audio.js","js/combat.js","js/data.js","js/frames.js","js/input.js","js/main.js","js/player.js","js/render.js","js/scene.js","js/sprite.js","js/world.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('azhar-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    // keep the Google Fonts files too, so text looks right offline
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => hit)));
});
