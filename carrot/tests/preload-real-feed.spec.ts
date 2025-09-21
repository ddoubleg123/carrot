import { test, expect, Page } from '@playwright/test';

// Base URL and path can be overridden via env
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
const PATH = process.env.E2E_FEED_PATH || '/home';

async function loginIfNeeded(page: Page): Promise<boolean> {
  const url = new URL(page.url());
  if (!url.pathname.includes('/login')) return true;
  const email = process.env.E2E_EMAIL || '';
  const password = process.env.E2E_PASSWORD || '';
  if (!email || !password) return false;
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 }).catch(() => {});
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill(email);
  await passInput.fill(password);
  const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
  await submit.click();
  await page.waitForLoadState('load');
  const after = new URL(page.url());
  return !after.pathname.includes('/login');
}

async function goToFeed(page: Page): Promise<boolean> {
  const candidates = [PATH, '/home', '/rabbit', '/test-dashboard', '/'];
  for (const p of candidates) {
    await page.goto(`${BASE}${p.startsWith('/') ? '' : '/'}${p}`, { waitUntil: 'load' });
    if (new URL(page.url()).pathname.includes('/login')) {
      const ok = await loginIfNeeded(page);
      if (!ok) continue;
      await page.goto(`${BASE}${p.startsWith('/') ? '' : '/'}${p}`, { waitUntil: 'load' });
      if (new URL(page.url()).pathname.includes('/login')) continue;
    }
    return true;
  }
  return false;
}

test.describe('Real feed preload summary (IDs and task types)', () => {
  test('collects enqueues and verifies offscreen preloading without scrolling', async ({ page }, testInfo) => {
    const ok = await goToFeed(page);
    if (!ok) test.skip(true, 'Could not reach a public feed page (login redirect). Set E2E_EMAIL/PASSWORD or E2E_FEED_PATH');

    // Ensure we have not scrolled
    await page.evaluate(() => window.scrollTo(0, 0));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    // Give the feed time to enqueue initial tasks (first 10) without any user scroll
    await page.waitForTimeout(1500);

    // Drain the in-browser MPQ log buffer
    const entries: Array<{ postId: string; type: string; feedIndex: number; priority: number; url: string; ts: number; }> = await page.evaluate(() => {
      const w: any = window as any;
      const buf = Array.isArray(w.__mpq_log) ? w.__mpq_log.slice() : [];
      return buf.filter(Boolean);
    });

    expect(entries.length).toBeGreaterThan(0);

    // Group by feedIndex
    const byIndex = new Map<number, Array<typeof entries[number]>>();
    for (const e of entries) {
      if (!byIndex.has(e.feedIndex)) byIndex.set(e.feedIndex, []);
      byIndex.get(e.feedIndex)!.push(e);
    }

    // Offscreen verification: expect at least some indices > 0 to have enqueues without scrolling
    const offscreenIndicesWithEnqueues: number[] = [];
    for (let i = 1; i <= 10; i++) {
      if ((byIndex.get(i) || []).length > 0) offscreenIndicesWithEnqueues.push(i);
    }
    expect(offscreenIndicesWithEnqueues.length, `Expected offscreen indices (1..10) to have enqueues without scrolling, got: [${offscreenIndicesWithEnqueues.join(', ')}]`).toBeGreaterThan(0);

    // Build summary lines for first 20 posts
    const maxIndexToShow = 20;
    const summaryLines: string[] = [];
    for (let i = 0; i < maxIndexToShow; i++) {
      const recs = (byIndex.get(i) || []).sort((a, b) => a.type.localeCompare(b.type));
      if (recs.length === 0) { summaryLines.push(`${i.toString().padStart(2, '0')} | (none)`); continue; }
      const postId = recs[0].postId; // all records for an index should share the same postId
      const types = Array.from(new Set(recs.map(r => r.type))).join(',');
      summaryLines.push(`${i.toString().padStart(2, '0')} | ${postId} | ${types}`);
    }

    const header = 'feedIndex | postId                        | taskTypes';
    const divider = '---------|-------------------------------|-------------------------------';
    const summaryText = [header, divider, ...summaryLines].join('\n');

    // Print and attach
    // eslint-disable-next-line no-console
    console.log('\nReal Feed Preload Summary (first 20 indices):\n' + summaryText + '\n');
    await testInfo.attach('real-feed-preload-summary.txt', { body: summaryText, contentType: 'text/plain' });
  });
});
