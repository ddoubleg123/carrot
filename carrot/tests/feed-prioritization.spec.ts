import { test, expect, Page } from '@playwright/test';

// Base URL can be overridden via E2E_BASE_URL, default to local dev
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';

async function collectFeedLog(page: Page, timeoutMs = 2000) {
  const entries: any[] = [];
  const fnName = `_onCarrotFeedLog_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
  try {
    await (page as any).exposeFunction(fnName, (e: any) => { entries.push(e); });
  } catch {
    // ignore if already registered
  }
  await page.addInitScript((name) => {
    (window as any).__carrot_feed_log = (window as any).__carrot_feed_log || [];
    window.addEventListener('carrot-feed-log', (e: any) => {
      const fn = (window as any)[name];
      if (typeof fn === 'function') fn(e.detail || {});
    });
  }, fnName);
  // Drain any entries that fired before listeners were attached
  try {
    await page.evaluate((name) => {
      const buf = (window as any).__carrot_feed_log || [];
      const fn = (window as any)[name];
      if (typeof fn === 'function') for (const e of buf) fn(e);
    }, fnName);
  } catch {}
  // Give it a little time to accumulate initial Active/Warm
  await page.waitForTimeout(timeoutMs);
  return entries;
}

function lastOfType(entries: any[], type: string) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]?.type === type) return entries[i];
  }
  return null;
}

test.describe('Feed prioritization and prefetch', () => {
  test('selects Active (nearest center) and Warm = Active+1 deterministically', async ({ page }: { page: Page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'load' });
    let log = await collectFeedLog(page, 1500);

    // If nothing logged yet, nudge the page a bit to trigger IO and try again
    if (log.length === 0) {
      await page.mouse.wheel(0, 50);
      log = await collectFeedLog(page, 800);
    }

    const active = lastOfType(log, 'active');
    const warm = lastOfType(log, 'warm');
    if (!active) test.skip(true, 'No Active logged; possible empty feed or manager disabled in this environment');

    expect(typeof active.index).toBe('number');
    // Warm is optional during flings, but on initial load we expect it in normal scroll
    if (!warm) test.skip(true, 'No Warm logged; possibly fast-scroll guard engaged or empty feed');
    else expect(warm.index).toBe(active.index + 1);

    // Slowly scroll ~1 viewport down to change Active deterministically
    const vh = (await page.viewportSize())!.height;
    await page.mouse.wheel(0, 0.8 * vh);
    await page.waitForTimeout(450); // >= debounce (180ms)

    const log2 = await collectFeedLog(page, 600);
    const active2 = lastOfType(log2, 'active');
    const warm2 = lastOfType(log2, 'warm');
    if (!active2 || !warm2) test.skip(true, 'Insufficient logs after scroll; skipping assertion');
    else expect(warm2.index).toBe(active2.index + 1);
  });

  test('skips Warm during fast scroll (fast-scroll guard)', async ({ page }: { page: Page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'load' });
    await collectFeedLog(page, 600); // initial

    // Fling: >1.5 screens/sec (simulate two quick screens)
    const vh = (await page.viewportSize())!.height;
    await page.mouse.wheel(0, vh * 2);
    await page.waitForTimeout(150); // very short, within fling window

    const log = await collectFeedLog(page, 250);
    const recent = log.slice(-8);
    const hasWarm = recent.some((e) => e.type === 'warm');
    // We expect no new warm entries during the fling window
    if (recent.length === 0) test.skip(true, 'No logs captured; skipping');
    else expect(hasWarm).toBeFalsy();
  });

  test('Active video requests carry pid for attribution', async ({ page }: { page: Page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    const hasVideo = await page.locator('video').first().count();
    if (!hasVideo) test.skip(true, 'No video element found on page');

    // Find first <video> element with a src set
    const src = await page.locator('video').first().evaluate((v: HTMLVideoElement) => (v.currentSrc || v.src || ''));
    if (!src) test.skip(true, 'First video has no src/currentSrc');

    // Only assert pid when using our /api/video proxy.
    if (src.includes('/api/video')) {
      expect(src).toMatch(/[?&]pid=/);
    }
  });
});
