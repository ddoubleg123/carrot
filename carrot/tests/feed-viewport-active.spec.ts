import { test, expect } from '@playwright/test';

// Utility: returns info about all <video> in viewport
async function queryVideos(page) {
  return await page.evaluate(() => {
    const vids = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const inViewport = vids.filter(v => {
      const r = v.getBoundingClientRect();
      return r.bottom > 0 && r.top < viewH && r.right > 0 && r.left < viewW;
    });
    const data = inViewport.map(v => {
      const r = v.getBoundingClientRect();
      const visibleH = Math.max(0, Math.min(r.bottom, viewH) - Math.max(r.top, 0));
      const visibleW = Math.max(0, Math.min(r.right, viewW) - Math.max(r.left, 0));
      const visibleArea = visibleH * visibleW;
      return {
        poster: v.getAttribute('poster') || '',
        currentSrc: v.currentSrc || '',
        paused: v.paused,
        readyState: v.readyState,
        currentTime: v.currentTime,
        width: r.width,
        height: r.height,
        top: r.top,
        visibleArea,
        // Identify element for click
        selector: (v.closest('[data-post-id]')?.getAttribute('data-post-id')) || undefined
      };
    });
    data.sort((a,b)=>b.visibleArea-a.visibleArea);
    return data;
  });
}

// Scroll helper: scroll by pixels and wait for settle
async function scrollBy(page, px: number) {
  await page.evaluate((dy) => { window.scrollBy(0, dy); }, px);
  await page.waitForTimeout(350);
}

// Public, no-login test page that renders a minimal feed with actual <video> tiles
const FEED_URL = '/test-preload?limit=12';

test.describe('Feed viewport prioritization and sticky behavior', () => {
  test('single active winner, manual override, poster guarantee, sticky resume', async ({ page }) => {
    await page.goto(FEED_URL, { waitUntil: 'load' });

    // Wait for at least 2 videos to appear on the public test page
    await page.waitForFunction(() => document.querySelectorAll('video').length >= 2, { timeout: 15000 });

    // Initial state: only one should be playing within viewport
    let vids = await queryVideos(page);
    expect(vids.length).toBeGreaterThanOrEqual(1);

    // Poster guarantee: top-most visible video should have a poster attribute
    expect(vids[0].poster?.length ?? 0).toBeGreaterThan(0);

    // Count playing videos (paused=false)
    const playingCount = vids.filter(v => v.paused === false).length;
    expect(playingCount).toBeLessThanOrEqual(1);

    // Scroll a bit to make a different tile the viewport winner
    await scrollBy(page, Math.round((await page.evaluate(()=>window.innerHeight)) * 0.65));

    vids = await queryVideos(page);
    const playingCount2 = vids.filter(v => v.paused === false).length;
    expect(playingCount2).toBeLessThanOrEqual(1);

    // Manual override: click the second-most visible video to force it Active
    // If only one video is visible, scroll slightly to include another
    if (vids.length < 2) {
      await scrollBy(page, 200);
      vids = await queryVideos(page);
    }
    const targetIndex = Math.min(1, vids.length - 1);
    const beforeClickTimes = await page.evaluate(() => Array.from(document.querySelectorAll('video')).map(v=>v.currentTime));
    await page.mouse.click(await page.evaluateHandle(() => {
      const vids = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      const viewH = window.innerHeight, viewW = window.innerWidth;
      const inViewport = vids.filter(v => { const r=v.getBoundingClientRect(); return r.bottom>0&&r.top<viewH&&r.right>0&&r.left<viewW; });
      const data = inViewport.map(v=>({ v, r: v.getBoundingClientRect(), a: Math.max(0, Math.min(v.getBoundingClientRect().bottom, viewH) - Math.max(v.getBoundingClientRect().top, 0)) * Math.max(0, Math.min(v.getBoundingClientRect().right, viewW) - Math.max(v.getBoundingClientRect().left, 0)) }));
      data.sort((x,y)=>y.a-x.a);
      return data[Math.min(1, data.length-1)].v; // the second most visible
    }).then((h:any)=>h.asElement()), { button: 'left' });

    await page.waitForTimeout(250);

    vids = await queryVideos(page);
    const playingCount3 = vids.filter(v => v.paused === false).length;
    expect(playingCount3).toBe(1);

    // Sticky resume: capture currentTime, scroll away and back, ensure time does not reset to 0
    const topTime = vids[0].currentTime;
    await scrollBy(page, 800);
    await scrollBy(page, -800);
    vids = await queryVideos(page);
    expect(vids[0].currentTime).toBeGreaterThanOrEqual(Math.max(0, topTime - 0.5));
  });
});
