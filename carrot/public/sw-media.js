/*
  Media Prefetch Service Worker (infra-only, no UI)
  - Listens for postMessage({ type: 'PREFETCH', urls: [...] }) from the app
  - Caches HLS playlist + first segment with a small LRU
  - Respects Data Saver and avoids caching on slow links
  - Does not globally intercept fetch; only prefetches what the app requests
*/

const CACHE_NAME = 'carrot-media-v1';
const MAX_ENTRIES = 120;          // ~small playlist/segment set
const MAX_TOTAL_BYTES = 120 * 1024 * 1024; // ~120 MB soft cap

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean old caches if we ever bump versions
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Utility: estimate cache size roughly (not exact); prune LRU by response date header when possible
async function enforceLimits(cache) {
  // Try to prune by count first
  const reqs = await cache.keys();
  if (reqs.length <= MAX_ENTRIES) return;
  // Delete oldest by If-Modified-Since friendly header when available
  const entries = [];
  for (const req of reqs) {
    const res = await cache.match(req);
    const lm = res?.headers.get('last-modified');
    const ts = lm ? Date.parse(lm) : 0;
    entries.push({ req, ts });
  }
  entries.sort((a,b) => a.ts - b.ts);
  const toDelete = Math.max(0, entries.length - MAX_ENTRIES);
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(entries[i].req);
  }
}

// Heuristic: check connection preferences
function allowPrefetch() {
  try {
    const nav = self.navigator || {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const saveData = !!conn?.saveData;
    const downlink = typeof conn?.downlink === 'number' ? conn.downlink : 10; // Mbps
    return !saveData && downlink >= 1.5;
  } catch {
    return true;
  }
}

self.addEventListener('message', (event) => {
  const data = event?.data || {};
  if (data.type === 'PREFETCH') {
    const urls = Array.isArray(data.urls) ? data.urls.slice(0, 2) : [];
    if (!urls.length) return;
    if (!allowPrefetch()) return;
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        // Fetch with no-store to force network then populate cache
        for (const u of urls) {
          try {
            const resp = await fetch(u, { cache: 'no-store' });
            if (resp.ok) await cache.put(u, resp.clone());
          } catch {}
        }
        await enforceLimits(cache);
      } catch {}
    })());
  }
  if (data.type === 'CLEAR_MEDIA_CACHE') {
    event.waitUntil((async () => {
      try {
        await caches.delete(CACHE_NAME);
      } catch {}
    })());
  }
});

// No fetch handler: this SW does not intercept normal requests.
