import { test, expect, Page } from '@playwright/test';

// Base URL can be overridden via E2E_BASE_URL, default to local dev
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';

async function go(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
}

test.describe('Initial preload queuing (first 10 posts)', () => {
  test('queues only posts 0..9 and uses correct task types', async ({ page }) => {
    await go(page, '/test-preload');

    // Wait for the harness flag to be present in the DOM (no visibility requirement)
    await page.waitForSelector('[data-testid="ready-flag"]', { state: 'attached', timeout: 10000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="ready-flag"]');
      return el && (el as HTMLElement).getAttribute('data-ready') === '1';
    }, { timeout: 10000 });

    // Also wait until the harness exposes some records
    await page.waitForFunction(() => Array.isArray((window as any).__mpq_enqueues) && (window as any).__mpq_enqueues.length > 0, { timeout: 10000 });

    // Pull the enqueue records from the harness
    const records = await page.evaluate(() => (window as any).__mpq_enqueues || []);
    expect(Array.isArray(records)).toBeTruthy();
    expect(records.length).toBeGreaterThan(0);

    // Group by feedIndex
    const byIndex: Map<number, any[]> = new Map();
    for (const r of records) {
      const idx = r.feedIndex as number;
      if (!byIndex.has(idx)) byIndex.set(idx, []);
      byIndex.get(idx)!.push(r);
    }

    // Assert indices 0..9 present, >=10 absent at initial queue time
    for (let i = 0; i < 10; i++) {
      expect(byIndex.has(i)).toBeTruthy();
    }
    expect(byIndex.has(10)).toBeFalsy();
    expect(byIndex.has(11)).toBeFalsy();

    // For our updated fixture (0..9):
    // 0 video, 1 image, 2 text, 3 audio, 4 video, 5 image, 6 text, 7 audio, 8 video, 9 image
    const TYPE = {
      POSTER: 'POSTER',
      VIDEO_PREROLL_6S: 'VIDEO_PREROLL_6S',
      IMAGE: 'IMAGE',
      TEXT_FULL: 'TEXT_FULL',
      AUDIO_META: 'AUDIO_META',
    } as const;

    const needPoster = new Set([0, 4, 8]);
    const needVideo6s = new Set([0, 4, 8]);
    const needImage = new Set([1, 5, 9]);
    const needText = new Set([2, 6]);
    const needAudioMeta = new Set([3, 7]);

    for (let i = 0; i < 10; i++) {
      const recs = byIndex.get(i)!;
      const types = new Set(recs.map(r => r.type));
      if (needPoster.has(i)) expect(types.has(TYPE.POSTER)).toBeTruthy();
      if (needVideo6s.has(i)) expect(types.has(TYPE.VIDEO_PREROLL_6S)).toBeTruthy();
      if (needImage.has(i)) expect(types.has(TYPE.IMAGE)).toBeTruthy();
      if (needText.has(i)) expect(types.has(TYPE.TEXT_FULL)).toBeTruthy();
      if (needAudioMeta.has(i)) expect(types.has(TYPE.AUDIO_META)).toBeTruthy();
    }
  });
});
