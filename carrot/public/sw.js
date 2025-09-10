// Lightweight prefetch Service Worker for feed media.
// Caches first playlist and first media segment for the next-in-view tile.
// Very conservative to avoid bandwidth/memory spikes.

const CACHE = 'carrot-media-v1';
const MAX_ENTRIES = 30; // soft cap

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Best-effort prefetch request from the page
// e.g. navigator.serviceWorker.controller.postMessage({ type: 'PREFETCH', urls: [playlistUrl, seg0Url] })
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'PREFETCH' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE);
        const urls = data.urls.slice(0, 2);
        await Promise.all(urls.map(async (u) => {
          try { await cache.add(new Request(u, { mode: 'no-cors' })); } catch {}
        }));
        // Soft prune
        const keys = await cache.keys();
        if (keys.length > MAX_ENTRIES) {
          for (let i = 0; i < keys.length - MAX_ENTRIES; i++) {
            await cache.delete(keys[i]);
          }
        }
      } catch {}
    })());
  }
  if (data.type === 'CLEAR_CACHE' || data.type === 'CLEAR_MEDIA_CACHE') {
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys();
        for (const k of keys) {
          if (k === CACHE || /^carrot-media-/i.test(k)) {
            await caches.delete(k);
          }
        }
      } catch {}
    })());
  }
});

// Cache-first only for items already in cache; otherwise pass-through
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only intercept HLS assets and small media chunks
  const url = new URL(req.url);
  const isHls = /\.m3u8($|\?)/i.test(url.pathname) || /\.(ts|m4s)($|\?)/i.test(url.pathname);
  if (!isHls) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      // Only cache small responses
      const clone = res.clone();
      try { await cache.put(req, clone); } catch {}
      return res;
    } catch (e) {
      // Offline: try cache
      const cached = await cache.match(req);
      if (cached) return cached;
      throw e;
    }
  })());
});
