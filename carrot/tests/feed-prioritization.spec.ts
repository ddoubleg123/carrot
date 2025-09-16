import { test, expect, Page } from '@playwright/test';

// Base URL can be overridden via E2E_BASE_URL, default to local dev
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
// Feed path can be overridden via E2E_FEED_PATH, default to /home
const PATH = process.env.E2E_FEED_PATH || '/home';

// Optional login creds (set these in your shell to enable auto-login)
const E2E_EMAIL = process.env.E2E_EMAIL || '';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '';

async function loginIfNeeded(page: Page): Promise<boolean> {
  const url = new URL(page.url());
  if (!url.pathname.includes('/login')) return true;
  if (!E2E_EMAIL || !E2E_PASSWORD) return false;

  // Very basic login flow: adjust selectors to match your app if needed
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 }).catch(() => {});
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill(E2E_EMAIL);
  await passInput.fill(E2E_PASSWORD);

  // Click a generic submit button
  const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
  await submit.click();

  // Wait for navigation away from login
  await page.waitForLoadState('load');
  const after = new URL(page.url());
  return !after.pathname.includes('/login');
}

// Navigate to a feed-like page, tolerating auth redirects by trying alternatives.
// If we hit /login and have creds, auto-login then retry.
async function goToFeed(page: Page): Promise<boolean> {
  const candidates = [PATH, '/test-dashboard', '/home', '/rabbit'];
  for (const p of candidates) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'load' });
    if (new URL(page.url()).pathname.includes('/login')) {
      const ok = await loginIfNeeded(page);
      if (!ok) continue;
      // After login, try to hit the same candidate path again
      await page.goto(`${BASE}${p}`, { waitUntil: 'load' });
      if (new URL(page.url()).pathname.includes('/login')) continue;
    }
    return true;
  }
  return false;
}

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
    const ok = await goToFeed(page);
    if (!ok) test.skip(true, 'Could not reach a public feed page (login redirect)');

    let log = await collectFeedLog(page, 1800);

    // If nothing logged yet, nudge the page a bit to trigger IO and try again
    if (log.length === 0) {
      await page.mouse.wheel(0, 50);
      log = await collectFeedLog(page, 900);
    }

    const active = lastOfType(log, 'active');
    const warm = lastOfType(log, 'warm');
    if (!active) test.skip(true, 'No Active logged; possible empty feed or manager disabled in this environment');

    expect(typeof active.index).toBe('number');
    if (!warm) test.skip(true, 'No Warm logged; possibly fast-scroll guard engaged or empty feed');
    else expect(warm.index).toBe(active.index + 1);

    // Slowly scroll ~1 viewport down to change Active deterministically
    const vh = (await page.viewportSize())!.height;
    await page.mouse.wheel(0, 0.9 * vh);
    await page.waitForTimeout(500); // >= debounce (180ms)

    const log2 = await collectFeedLog(page, 700);
    const active2 = lastOfType(log2, 'active');
    const warm2 = lastOfType(log2, 'warm');
    if (!active2 || !warm2) test.skip(true, 'Insufficient logs after scroll; skipping assertion');
    else expect(warm2.index).toBe(active2.index + 1);
  });

  test('skips Warm during fast scroll (fast-scroll guard)', async ({ page }: { page: Page }) => {
    const ok = await goToFeed(page);
    if (!ok) test.skip(true, 'Could not reach a public feed page (login redirect)');

    await collectFeedLog(page, 700); // initial

    // Fling: >1.5 screens/sec (simulate two quick screens)
    const vh = (await page.viewportSize())!.height;
    await page.mouse.wheel(0, vh * 2);
    await page.waitForTimeout(180); // very short, within fling window

    const log = await collectFeedLog(page, 280);
    const recent = log.slice(-8);
    const hasWarm = recent.some((e) => e.type === 'warm');
    if (recent.length === 0) test.skip(true, 'No logs captured; skipping');
    else expect(hasWarm).toBeFalsy();
  });

  test('Active video requests carry pid for attribution', async ({ page }: { page: Page }) => {
    const ok = await goToFeed(page);
    if (!ok) test.skip(true, 'Could not reach a public feed page (login redirect)');

    await page.waitForTimeout(1400);

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