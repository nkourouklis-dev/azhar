// Builds the GitHub Pages site into docs/: a full HTML page with the iPhone home-screen
// metadata, a web app manifest, and a service worker so the game also plays offline.
// Usage: node build.js
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'azhar'), out = path.join(__dirname, 'docs');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    fs.statSync(a).isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
};
copyDir(path.join(src, 'js'), path.join(out, 'js'));
copyDir(path.join(src, 'icons'), path.join(out, 'icons'));

const body = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const html = `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#07090f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Azhar">
<meta name="description" content="Azhar: Η Φυλακή του Βεζίρη. Παιχνίδι δράσης με σπαθιά, παγίδες και μια κλεψύδρα.">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
</head>
<body>
${body}
<script>
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), html);

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Azhar: Η Φυλακή του Βεζίρη', short_name: 'Azhar', lang: 'el',
  start_url: './', scope: './', display: 'fullscreen', orientation: 'any',
  background_color: '#07090f', theme_color: '#07090f',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

const files = ['./', 'index.html', 'manifest.webmanifest',
  ...fs.readdirSync(path.join(out, 'js')).map(f => 'js/' + f),
  ...fs.readdirSync(path.join(out, 'icons')).map(f => 'icons/' + f)];
fs.writeFileSync(path.join(out, 'sw.js'), `// Offline cache. A new build changes the version, which replaces the old cache.
const CACHE = 'azhar-${version}';
const FILES = ${JSON.stringify(files)};
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
`);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built docs/ (version ' + version + ', ' + files.length + ' files cached for offline)');
