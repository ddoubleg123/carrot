import { test, expect, Page } from '@playwright/test';

// Base URL and path can be overridden via env
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
const PATH = process.env.E2E_FEED_PATH || '/home';
const STORAGE = process.env.E2E_STORAGE_STATE; // optional path to a Playwright storage state JSON

// If a storage state is provided, use it to avoid interactive login
if (STORAGE) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (test as any).use?.({ storageState: STORAGE });
}

async function goToFeed(page: Page): Promise<boolean> {
  const p = PATH.startsWith('/') ? PATH : `/${PATH}`;
  await page.goto(`${BASE}${p}`, { waitUntil: 'load' });
  // If your app redirects to login, user should provide STORAGE or credentials envs; we proceed observationally.
  return true;
}

// Try to extract DOM order of post IDs using common selectors/strategies from the real app
async function getDomOrder(page: Page): Promise<Array<{ domIndex: number; postId: string }>> {
  return await page.evaluate(() => {
    const results: Array<{ domIndex: number; postId: string }> = [];

    // Helper to push unique IDs in DOM order
    const seen = new Set<string>();
    function push(id: string | null | undefined, i: number) {
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      results.push({ domIndex: i, postId: id });
    }

    // Strategy 1: explicit data attribute
    const byDataAttr = Array.from(document.querySelectorAll('[data-post-id]'));
    if (byDataAttr.length > 0) {
      byDataAttr.forEach((el, i) => push((el as HTMLElement).getAttribute('data-post-id'), i));
    }

    // Strategy 2: elements with known testid
    if (results.length === 0) {
      const byTestId = Array.from(document.querySelectorAll('[data-testid="post"],[data-testid="feed-post"],[data-testid="feedItem"]'));
      byTestId.forEach((el, i) => {
        const id = (el as HTMLElement).getAttribute('data-id')
          || (el as HTMLElement).getAttribute('data-postid')
          || (el as HTMLElement).id
          || (el as HTMLElement).getAttribute('data-key');
        push(id, i);
      });
    }

    // Strategy 3: look for id in child attribute
    if (results.length === 0) {
      const candidates = Array.from(document.querySelectorAll('[id*="post"], [class*="post"], article, section'));
      candidates.forEach((el, i) => {
        const id = (el as HTMLElement).getAttribute('data-id')
          || (el as HTMLElement).getAttribute('data-key')
          || (el as HTMLElement).id;
        if (id && /[a-z0-9]{10,}/i.test(id)) push(id, i);
      });
    }

    return results;
  });
}

// Collect MPQ enqueues: read buffer and, if empty, listen briefly for live events
async function collectMpqEnqueues(page: Page, listenMs = 2500): Promise<Array<{ postId: string; type: string; feedIndex: number; priority: number; url: string; ts: number }>> {
  // First, try existing buffer
  let entries: Array<any> = await page.evaluate(() => {
    const w: any = window as any;
    return Array.isArray(w.__mpq_log) ? w.__mpq_log.slice() : [];
  });
  if (entries.length > 0) return entries;

  // If empty, attach a temporary listener and wait a bit
  await page.evaluate((ms) => {
    const w: any = window as any;
    if (!Array.isArray(w.__mpq_tap)) w.__mpq_tap = [];
    function onEvent(e: any) { try { w.__mpq_tap.push(e.detail); } catch {}
    }
    w.__mpq_tap = [];
    w.addEventListener && w.addEventListener('mpq-enqueue', onEvent);
    setTimeout(() => {
      w.removeEventListener && w.removeEventListener('mpq-enqueue', onEvent);
      try { w.__mpq_tap_done = 1; } catch {}
    }, ms);
  }, listenMs);

  // Wait for the listener window
  await page.waitForTimeout(listenMs + 50);

  // Read what we captured
  entries = await page.evaluate(() => {
    const w: any = window as any;
    const buf = Array.isArray(w.__mpq_log) ? w.__mpq_log.slice() : [];
    const tap = Array.isArray(w.__mpq_tap) ? w.__mpq_tap.slice() : [];
    return [...buf, ...tap].filter(Boolean);
  });

  return entries as any;
}

test.describe('Real feed preload summary (IDs and task types)', () => {
  test('collects DOM order and MPQ enqueues (observational)', async ({ page }, testInfo) => {
    await goToFeed(page);

    // Ensure we have not scrolled; measure at top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Give initial render a moment
    await page.waitForTimeout(1000);

    // Collect DOM order of real posts as seen in the page
    const domOrder = await getDomOrder(page);

    // Collect MediaPreloadQueue enqueues (buffer or live during a short window)
    const entries = await collectMpqEnqueues(page, 2500);

    // Build outputs
    const domLines = domOrder.map(d => `${String(d.domIndex).padStart(2,'0')} | ${d.postId}`);

    const timeOrdered = entries
      .slice()
      .sort((a, b) => a.ts - b.ts)
      .map(e => `${new Date(e.ts).toISOString()} | idx:${String(e.feedIndex ?? '').padStart(2,'0')} | ${e.postId} | ${e.type}`);

    const summaryHeader = 'feedIndex | postId                        | taskTypes';
    const summaryDivider = '---------|-------------------------------|-------------------------------';
    const byIndex = new Map<number, Array<typeof entries[number]>>();
    for (const e of entries) {
      if (typeof e.feedIndex !== 'number') continue;
      if (!byIndex.has(e.feedIndex)) byIndex.set(e.feedIndex, []);
      byIndex.get(e.feedIndex)!.push(e);
    }
    const summaryLines: string[] = [];
    const maxIndexToShow = 30;
    for (let i = 0; i < maxIndexToShow; i++) {
      const recs = (byIndex.get(i) || []).sort((a, b) => String(a.type).localeCompare(String(b.type)));
      if (recs.length === 0) { summaryLines.push(`${i.toString().padStart(2,'0')} | (none)`); continue; }
      const postId = recs[0].postId;
      const types = Array.from(new Set(recs.map(r => r.type))).join(',');
      summaryLines.push(`${i.toString().padStart(2,'0')} | ${postId} | ${types}`);
    }

    const domText = ['domIndex | postId', '---------|-------------------------------', ...domLines].join('\n');
    const timeText = timeOrdered.join('\n');
    const summaryText = [summaryHeader, summaryDivider, ...summaryLines].join('\n');

    // Print and attach (observational: do not fail if empty)
    // eslint-disable-next-line no-console
    console.log('\nDOM order (top of page):\n' + domText + '\n');
    // eslint-disable-next-line no-console
    console.log('\nTime-ordered enqueues:\n' + (timeText || '(none)') + '\n');
    // eslint-disable-next-line no-console
    console.log('\nEnqueue summary by index (first 30):\n' + summaryText + '\n');

    await testInfo.attach('real-feed-dom-order.txt', { body: domText, contentType: 'text/plain' });
    await testInfo.attach('real-feed-time-ordered.txt', { body: timeText || '(none)', contentType: 'text/plain' });
    await testInfo.attach('real-feed-summary.txt', { body: summaryText, contentType: 'text/plain' });

    // No hard assertions here: this test is an observational inspector for @daniel
    expect(true).toBeTruthy();
  });
});
