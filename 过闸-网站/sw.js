/* 过闸 · Service Worker
   外壳预缓存（html/css/js/data/icon），图片按需缓存 —— 展会上断网也能翻。

   ⚠ 更新网站后执行 `node bump.js`：它会把下面这行的日期戳改成当前时间。
     版本号一变，浏览器才会丢掉旧缓存、拉取新版本。 */
const VERSION = 'guozha-20261025-1637';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './station.js',
  './custom.js',
  './ledger.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './data/geo.js',
  './data/china_geo.js',
  './data/stations.js',
  './data/poems.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* 图片、纹理：缓存优先，抓到就存 */
  if (/\.(jpg|jpeg|png|webp|svg)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  /* 外壳：网络优先，断网回退缓存 */
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
