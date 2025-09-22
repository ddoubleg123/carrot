import { test, expect } from '@playwright/test';

// This spec verifies that the live feed/test page loads media through our proxies
// without requiring a login. It observes network requests and asserts:
// - Videos go through /api/video and support Range (206 or Accept-Ranges: bytes)
// - Posters/images go through /api/img with 2xx
// - No direct storage.googleapis.com/firebasestorage.googleapis.com .mp4 loads
// - No Next.js double-wrapping of /api/img via /_next/image
//
// Configure target via env:
// E2E_BASE_URL=https://carrot-app.onrender.com  E2E_FEED_PATH=/test-preload  pnpm test:e2e

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
// Prefer the test harness page that does not require auth
const PATH = process.env.E2E_FEED_PATH || '/test-preload';

function isApiVideo(url: string) {
  try { const u = new URL(url); return u.pathname.startsWith('/api/video'); } catch { return false; }
}
function isApiImg(url: string) {
  try { const u = new URL(url); return u.pathname.startsWith('/api/img'); } catch { return false; }
}
function isNextImageWrap(url: string) {
  try { const u = new URL(url); return u.pathname.startsWith('/_next/image') && (u.search || '').includes('%2Fapi%2Fimg'); } catch { return false; }
}
function isDirectStorageVideo(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isStorageHost = host.includes('storage.googleapis.com') || host.includes('firebasestorage.googleapis.com');
    const isVideo = /\.mp4(\b|$)/i.test(u.pathname);
    return isStorageHost && isVideo;
  } catch { return false; }
}

// Utility to wait and collect network traffic for N ms
async function collectNetwork(page, ms: number) {
  const entries: Array<{ url: string; status: number; headers: Record<string,string> }> = [];
  const handler = async (resp) => {
    try {
      const url = resp.url();
      const status = resp.status();
      const headers = resp.headers();
      entries.push({ url, status, headers: headers as any });
    } catch {}
  };
  page.on('response', handler);
  await page.waitForTimeout(ms);
  page.off('response', handler);
  return entries;
}

// Basic observer test that does not require auth
// Visits PATH and watches network for a brief window.
// Fails if direct storage video URLs are used, or if Next.js double-wrap is observed.
// Asserts that any /api/video responses are ranged, and /api/img are 2xx.

test.describe('Live media proxy on public test page', () => {
  test('uses /api/video and /api/img correctly (no direct storage)', async ({ page }, testInfo) => {
    const target = `${BASE}${PATH.startsWith('/') ? PATH : '/' + PATH}`;
    await page.goto(target, { waitUntil: 'load' });

    // Give the page a moment to enqueue and start first loads
    await page.waitForTimeout(1000);

    // Collect network activity for a short observation window
    const responses = await collectNetwork(page, 5000);

    const apiVideo = responses.filter(r => isApiVideo(r.url));
    const apiImg = responses.filter(r => isApiImg(r.url));
    const nextWrap = responses.filter(r => isNextImageWrap(r.url));
    const directStorageVid = responses.filter(r => isDirectStorageVideo(r.url));

    const diag = [
      `Visited: ${target}`,
      `Total responses: ${responses.length}`,
      `apiVideo: ${apiVideo.length}`,
      `apiImg: ${apiImg.length}`,
      `nextWrap(_next/image->/api/img): ${nextWrap.length}`,
      `directStorageVideo(.mp4): ${directStorageVid.length}`,
    ].join('\n');

    await testInfo.attach('media-proxy-diag.txt', { body: diag, contentType: 'text/plain' });

    // 1) There should be no Next.js double-wrapping of /api/img
    expect(nextWrap.length, 'Detected Next.js optimizer wrapping /api/img').toBe(0);

    // 2) There should be no direct storage .mp4 loads
    expect(directStorageVid.length, 'Detected direct storage video loads (should proxy via /api/video)').toBe(0);

    // 3) Any /api/video responses we did see should be ranged
    for (const r of apiVideo) {
      const status = r.status;
      const acceptRanges = (r.headers['accept-ranges'] || r.headers['Accept-Ranges'] || '').toLowerCase();
      const okRanged = status === 206 || acceptRanges.includes('bytes');
      expect(okRanged, `/api/video not ranged: ${r.url} (status=${status}, accept-ranges=${acceptRanges})`).toBeTruthy();
    }

    // 4) Any /api/img poster/image loads should be 2xx
    for (const r of apiImg) {
      expect(r.status, `/api/img non-2xx for ${r.url}`).toBeGreaterThanOrEqual(200);
      expect(r.status, `/api/img non-2xx for ${r.url}`).toBeLessThan(300);
    }
  });
});
