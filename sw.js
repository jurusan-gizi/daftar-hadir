/* Service worker: tampilan aplikasi tetap terbuka saat sinyal lemah. Data selalu diambil dari server. */
var CACHE = 'daftar-hadir-v3';
var SHELL = [
  './', 'index.html', 'hadir.html', 'sertifikat.html', 'rekap.html', 'materi.html', 'laporan.html', 'logo.png', 'kop.png', 'manifest.webmanifest',
  'css/style.css', 'js/config.js', 'js/umum.js', 'js/ttd.js', 'js/hadir.js', 'js/app.js', 'js/cover.js', 'js/laporan.js',
  'vendor/pdf-lib.min.js', 'vendor/qrcode.js', 'vendor/xlsx.mini.min.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // API Apps Script tidak di-cache
  // Jaringan dulu, cadangan dari cache
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok && u.pathname.indexOf('/daftar-hadir/') >= 0) { var salin = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, salin); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
