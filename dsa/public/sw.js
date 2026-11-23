// Service worker: offline support + push notifications.
const VERSION = 'v1.1.0';
const SHELL_CACHE = `shell-${VERSION}`;
const DATA_CACHE = 'data-v1';
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/notifications.js',
  '/js/views.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/badge-96.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-data') event.waitUntil(caches.delete(DATA_CACHE));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/go/') || url.pathname.startsWith('/api/cron')) return;

  // API reads: network first, saved copy when offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstData(req));
    return;
  }

  // Page loads: network first, cached app shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  // Static files: serve from cache, refresh in the background.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

async function networkFirstData(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (!cached) return new Response(JSON.stringify({ error: "You're offline" }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    const headers = new Headers(cached.headers);
    headers.set('X-From-Cache', '1');
    return new Response(await cached.blob(), { status: 200, headers });
  }
}

// ---------- push notifications ----------

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Daily DSA', body: event.data?.text() };
  }
  const title = data.title || 'Daily DSA';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Time for today's DSA problem!",
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'daily-dsa',
      renotify: true,
      data: { url: data.url || '/#/', appUrl: data.appUrl || '/#/' },
      actions: [
        { action: 'open', title: 'Open on LeetCode' },
        { action: 'plan', title: "Today's plan" },
      ],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, appUrl } = event.notification.data || {};
  const target = event.action === 'plan' ? appUrl || '/#/' : url || '/#/';
  event.waitUntil(
    (async () => {
      // If the app is already open and we're going to the app, focus it.
      if (target.startsWith(self.location.origin) || target.startsWith('/')) {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = all.find((c) => new URL(c.url).origin === self.location.origin);
        if (existing) {
          await existing.focus();
          return existing.navigate(target).catch(() => {});
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
