# Carrot Feed Media Preloading and Playback Design

Last updated: 2025-09-22

## Goals
- Smooth feed: first 10 posts ready in order.
- Video: thumbnail first, then 6s preroll; instant start when visible.
- Prioritization: P0 = viewport, P1–P10 = next 10 strictly ordered, support backscroll.
- Persistence: never show black; freeze last frame on pause; instant backscroll resume.
- No refetch storms: cache-friendly headers, Range support, in-memory LRU, request dedupe.

## Key Components
- `src/components/video/FeedMediaManager.ts`
  - Owns Active/Warm/Paused states across tiles.
  - Seeds preloading and keeps sticky window (±10) elements.
  - API:
    - `setPosts(PostAsset[])`
    - `setViewportIndex(index: number)`
    - `registerHandle(el, handle)` / `unregisterHandle(el)`
    - `setActive(handle)` / `setWarm(handle)` / `setPaused(handle)` / `setIdle(handle)`
- `src/lib/MediaPreloadQueue.ts`
  - Central preloading queue.
  - Task types: `POSTER`, `VIDEO_PREROLL_6S`, `IMAGE`, `AUDIO_META`, `TEXT_FULL`.
  - Emits `window.__mpq_log` entries and `mpq-enqueue` events.
  - Sequential gating via `lastCompletedPosterIndex/VideoIndex` and `canStartTask()`.
  - In-flight/memory budgeting, concurrency limits.
- Players
  - `src/app/(app)/dashboard/components/VideoPlayer.tsx`
    - Ensures `muted`, `playsInline`, `preload` policy, and concurrency (only one plays).
    - Registers with `FeedMediaManager` to participate in Active/Warm.
- Server APIs
  - `src/app/api/posts/route.ts` — newest-first feed (createdAt desc).
  - `src/app/api/video/route.ts` — proxy with `Accept-Ranges`, 200/206, `ETag` passthrough, `Cache-Control`.
  - `src/app/api/img/route.ts` — image/thumb proxy with cache headers and ETag.

## Data Flow (Happy Path)
1. Server renders `/home` with latest posts.
2. Client mount in `DashboardClient.tsx` maps posts to `PostAsset[]` and calls `FeedMediaManager.inst.setPosts(posts)`.
3. `FeedMediaManager.queueInitialPosts()` enqueues 0..9 with priority `NEXT_10`.
4. For each post:
   - Video: enqueue `POSTER` then `VIDEO_PREROLL_6S`.
   - Image: enqueue `IMAGE`.
   - Audio: enqueue `AUDIO_META`.
   - Text: enqueue `TEXT_FULL`.
5. `MediaPreloadQueue` fetches URLs with Range where applicable and logs to `__mpq_log`.
6. When user scrolls, `setViewportIndex(N)` promotes P0 (VISIBLE) and P1–P10 (NEXT_10). One video plays at a time. Others are paused with frozen frame.

## Prioritization Rules
- Initial load: indices 0..9.
- Scrolling: P0 then next 10; also retain previous 5 for instant backscroll.
- Sticky window: video elements persist within ±10 indices; beyond 3 screen heights, release.

## Cache & Fetch Strategy
- `/api/video`:
  - Forward/normalize storage URLs.
  - Range support: `206 Partial Content` + `Content-Range`, `Accept-Ranges: bytes`.
  - Pass through `ETag`/`Last-Modified`; set sane `Cache-Control` (immutable for unsigned URLs).
  - In-flight dedupe to prevent request storms.
- `/api/img`:
  - `Cache-Control: public, max-age` and `ETag`; supports durable posters.
- Client prefetch requests must be reusable by `<video>` element. Headers above are mandatory for instant start.

## Observability
- `window.__mpq_log` ring buffer (last ~600 entries) and `mpq-enqueue` events.
- Public observer page: `/test-feed-observer` (no login) shows live enqueues.
- Playwright inspectors:
  - `tests/preload-real-feed.spec.ts` — observational on real feed (requires session).
  - `tests/preload-initial-queue.spec.ts` — deterministic with `E2E_TEST_IDS` (no login).

## Player Behavior
- Autoplay only when visible; `muted`, `playsInline` enforced.
- On pause/backscroll: store `currentTime`, `bufferedRanges`, and capture frozen frame in `MediaStateCache`.
- Resume from cache: avoid black; instant repaint with poster/frozen frame.

## Edge Cases & Guards
- Fast scroll: skip warming to avoid wasted network.
- Memory budget: 8 MB default for queue; tune per device.
- Sequential gap: do not prefetch far ahead (default gap 10 indices).

## Test Plan
- Observer: open `/test-feed-observer` and verify POSTER and 6s entries within ~1.5s; Network shows 206 ranges with Content-Range.
- Harness: run `preload-initial-queue.spec.ts` with `E2E_TEST_IDS` to confirm P0..P10 order and video sequencing.
- Real feed: with storage state, confirm DOM order + enqueues appear without scrolling.

## Future Work
- Service Worker (`/sw-media.js`) to cache HLS segments for longer tails.
- Adaptive preroll size by connection type.
- Metrics: time-to-first-frame, prefetch hit rate, revalidation rate.
