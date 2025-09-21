import { test, expect, Page } from '@playwright/test';

// Base URL can be overridden via E2E_BASE_URL, default to local dev
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
const IDS = process.env.E2E_TEST_IDS; // comma-separated post IDs

async function go(page: Page, path: string) {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'load' });
}

function pathWithIds(basePath: string): string {
  if (!IDS) return basePath;
  const q = new URLSearchParams({ ids: IDS }).toString();
  return `${basePath}?${q}`;
}

function expectedCountFromIds(): number {
  if (!IDS) return 10;
  const count = IDS.split(',').map(s => s.trim()).filter(Boolean).length;
  return Math.min(10, count);
}

test.describe('Initial preload queuing (first 10 posts)', () => {
  test('queues only posts 0..9 and uses correct task types', async ({ page }, testInfo) => {
    const targetPath = pathWithIds('test-preload');
    await go(page, targetPath);

    // Debug: print the actual URL navigated to and any ids detected by the harness
    const currentUrl = page.url();
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] Navigated to: ${currentUrl}`);

    // Wait for the harness flag to be present in the DOM (no visibility requirement)
    await page.waitForSelector('[data-testid="ready-flag"]', { state: 'attached', timeout: 10000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="ready-flag"]');
      return el && (el as HTMLElement).getAttribute('data-ready') === '1';
    }, { timeout: 10000 });

    // Also wait until the harness exposes some records
    await page.waitForFunction(() => Array.isArray((window as any).__mpq_enqueues) && (window as any).__mpq_enqueues.length > 0, { timeout: 10000 });

    // Pull the enqueue records from the harness
    const records: Array<{ postId: string; type: string; priority: number; feedIndex: number; url: string; bucket?: string; path?: string; }> = await page.evaluate(() => (window as any).__mpq_enqueues || []);
    expect(Array.isArray(records)).toBeTruthy();
    expect(records.length).toBeGreaterThan(0);

    // Debug: show any ids the harness read from the query
    const harnessIds = await page.evaluate(() => {
      try {
        const sp = new URLSearchParams(window.location.search);
        return sp.get('ids') || '';
      } catch { return ''; }
    });
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] Harness ids query: ${harnessIds || '(none)'}`);

    // Group by feedIndex
    const byIndex: Map<number, any[]> = new Map();
    for (const r of records) {
      const idx = r.feedIndex as number;
      if (!byIndex.has(idx)) byIndex.set(idx, []);
      byIndex.get(idx)!.push(r);
    }

    const observationalMode = !!IDS; // when real IDs are passed, only log, don't assert exact shape

    if (!observationalMode) {
      // Strict assertions for default harness
      for (let i = 0; i < 10; i++) {
        expect(byIndex.has(i)).toBeTruthy();
      }
      expect(byIndex.has(10)).toBeFalsy();
      expect(byIndex.has(11)).toBeFalsy();

      // For our updated fixture order across 0..9: 0 v,1 i,2 t,3 a,4 v,5 i,6 t,7 a,8 v,9 i
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
    }

    // Build and log a concise summary for operator visibility (feedIndex, postId, task types)
    const maxIndexToShow = observationalMode ? Math.max(12, expectedCountFromIds()) : 12;
    const summaryLines: string[] = [];
    for (let i = 0; i < maxIndexToShow; i++) {
      const recs = (byIndex.get(i) || []).sort((a, b) => a.type.localeCompare(b.type));
      if (recs.length === 0) {
        summaryLines.push(`${i.toString().padStart(2, '0')} | (none)`);
        continue;
      }
      const postId = recs[0].postId;
      const types = Array.from(new Set(recs.map(r => r.type))).join(',');
      summaryLines.push(`${i.toString().padStart(2, '0')} | ${postId} | ${types}`);
    }

    const header = 'feedIndex | postId  | taskTypes';
    const divider = '---------|---------|-------------------------';
    const summaryText = [header, divider, ...summaryLines].join('\n');

    // Print to test output
    // eslint-disable-next-line no-console
    console.log(`\nPreload Summary (${observationalMode ? 'observational, real IDs' : 'first 12 indices'}):\n` + summaryText + '\n');

    // Attach to report
    await testInfo.attach('preload-summary.txt', { body: summaryText, contentType: 'text/plain' });
  });
});
