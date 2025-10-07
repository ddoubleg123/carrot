# Carrot App - Tech Stack Analysis & Failure Report
**Date:** October 7, 2025  
**Status:** CRITICAL - Video Loading Completely Broken

---

## Executive Summary

The Carrot application's video loading system has completely failed. Users are experiencing:
- Videos stuck on "Loading..." indefinitely
- `ERR_CONNECTION_CLOSED` errors for images and videos
- HTTP 499 client-canceled requests across the entire application
- Complete feed freeze

**Root Cause:** Over-conservative throttling and a catastrophic sequential loading bug (`maxSequentialGap: 0`) that created a single point of failure. While the gap has been fixed to `5`, the overall system is still too restrictive.

---

## Current Tech Stack

### Frontend
- **Framework:** Next.js 14+ (React-based)
- **Language:** TypeScript
- **State Management:** React hooks, custom managers
- **Media Loading:** Custom `MediaPreloadQueue` with relaxed sequential loading (10 post gap)
- **Video Handling:** Native HTML5 `<video>` elements
- **Network Layer:** Custom `http1Fetch` wrapper (direct fetch, no global throttling)

### Backend
- **Runtime:** Node.js 20.x
- **Server:** Custom HTTP/1.1 server (`server.js`) - explicitly forcing HTTP/1.1
- **API Routes:** Next.js API routes (`/api/*`)
- **Database:** Prisma ORM with PostgreSQL
- **Storage:** Firebase Storage for media assets

### Deployment
- **Platform:** Render.com (Free tier)
- **Protocol:** HTTP/1.1 (forced via custom server)
- **CDN:** None (direct server-to-client)
- **SSL:** Render-managed HTTPS

### Network Architecture (UPDATED ✓)
1. ~~**GlobalRequestManager:**~~ **REMOVED** - Was causing more problems than solving

2. **MediaPreloadQueue:** Media-specific loading (UPDATED ✓)
   - Posters: 4 concurrent (was 1)
   - Videos: 3 concurrent (was 1)
   - Sequential gap: 10 posts ahead (was 5)
   - Global budget: 16MB
   - **VISIBLE priority bypass:** Visible posts ignore sequential restrictions
   - **No artificial delays:** Removed 100ms delay between tasks

3. **ConnectionPool:** HTTP/1.1 connection management
   - Max 6 connections per host
   - 45-second timeout
   - Automatic cleanup

4. **http1Fetch:** Protocol-level HTTP/1.1 forcing (SIMPLIFIED ✓)
   - Direct `fetch()` calls (no global throttling)
   - Aggressive header manipulation
   - Retry logic with exponential backoff
   - Firebase Storage special handling (minimal headers only)

---

## What Went Wrong: Timeline of Failures

### Phase 1: Initial HTTP/2 Errors (Days 1-3)
**Problem:** Render.com's load balancer was negotiating HTTP/2, causing `ERR_HTTP2_PROTOCOL_ERROR`

**What We Tried:**
1. Environment variables to force HTTP/1.1 (`DISABLE_HTTP2=true`, etc.)
2. Custom HTTP/1.1 headers in fetch requests
3. Next.js webpack configuration adjustments
4. Connection pooling for reuse

**Result:** Partial success. Errors reduced but not eliminated.

---

### Phase 2: Chunk Loading Errors (Days 3-5)
**Problem:** CSS and JavaScript chunks failing with `ChunkLoadError` and `Invalid or unexpected token`

**What We Tried:**
1. Conservative webpack chunk splitting (larger chunks, fewer requests)
2. Single CSS bundle to prevent fragmentation
3. Aggressive cache clearing and page reloads
4. Global error handlers for unhandled exceptions

**Result:** Mostly resolved. CSS errors significantly reduced.

---

### Phase 3: Connection Overload (Days 5-7)
**Problem:** Browser connection limits exceeded, causing HTTP 499 (client canceled) errors

**What We Tried:**
1. Implemented `GlobalRequestManager` with strict throttling
2. Reduced `MediaPreloadQueue` concurrency to 1 for all types
3. Added 200ms delay between all requests
4. Implemented request deduplication

**Result:** Mixed. Videos started loading but very slowly.

---

### Phase 4: CATASTROPHIC FAILURE (Day 7-8) ⚠️
**Problem:** Videos completely stopped loading. Feed frozen.

**What We Did Wrong:**
1. **Set `maxSequentialGap` to 0:** This meant ONLY the current post could load. If it failed, the entire feed froze.
2. **Enabled blocking:** Set `posterBlocksProgression: true` and `videoBlocksProgression: true`. If the first poster failed, nothing else could load.
3. **Ultra-aggressive delays:** 1-2 second delays for videos, 300-500ms for all media.
4. **Too strict throttling:** 2 concurrent requests max, 2 requests/second max, 500ms delay between all requests.

**Why This Broke Everything:**
- Single point of failure: If post #0 failed to load, posts #1, #2, #3, etc. were all blocked
- No buffer: No lookahead meant no preloading whatsoever
- Cascading failures: One failed poster blocked all videos
- Extremely slow: Even successful loads took 5-10 seconds due to delays

**Current Status After Partial Fix:**
- `maxSequentialGap` increased to 5 ✓
- Blocking disabled (`posterBlocksProgression: false`, `videoBlocksProgression: false`) ✓
- GlobalRequestManager loosened (4 concurrent, 6/sec, 200ms delay) ✓
- But still experiencing severe issues

---

### Phase 5: Custom HTTP/1.1 Server (Day 8)
**Problem:** Next.js still potentially negotiating HTTP/2 despite environment variables

**What We Tried:**
1. Created `server.js` using Node.js `http.createServer` (HTTP/1.1 only)
2. Updated `package.json` and `render.yaml` to use custom server
3. Added aggressive HTTP/1.1 response headers

**Result:** Not yet fully tested. May help but doesn't address core issues.

---

## Current Issues (As of Latest Error Logs)

### 1. ERR_CONNECTION_CLOSED
**Frequency:** High  
**Affected APIs:** `/api/img`, `/api/auth/session`, `/api/user/stats`  
**Likely Cause:** 
- Render.com free tier connection instability
- HTTP/1.1 keep-alive not working properly
- Server dropping connections under load

### 2. HTTP 499 Errors
**Frequency:** Very High  
**Affected APIs:** `/api/video`, `/api/auth/session`  
**Cause:** 
- Browser canceling requests due to:
  - Request taking too long (throttling delays)
  - User scrolling (causing component unmount)
  - Browser connection limit reached
  - Timeout (30-second limit)

### 3. Videos Not Loading
**Frequency:** Constant  
**Symptoms:** 
- Stuck on "Loading..." state
- First video works, rest don't
- Thumbnail flickers then disappears

**Root Cause Analysis:**
1. **Sequential Loading Too Strict:** Even with `maxSequentialGap: 5`, the system is too conservative
2. **Request Deduplication Bug:** Multiple components requesting same video URL, but deduplication may be blocking legitimate retries
3. **GlobalRequestManager Too Conservative:** 4 concurrent requests is too low for a feed with multiple videos visible
4. **MediaPreloadQueue Too Slow:** 1 concurrent video at a time with 100ms delays means very slow loading
5. **No Progressive Loading:** Videos are all-or-nothing; no streaming or partial loading

---

## What's Wrong with the Current Architecture

### 1. Too Many Layers of Throttling (FIXED ✓)
We ~~have~~ had **4 layers** of throttling, all fighting each other:
1. ~~GlobalRequestManager (4 concurrent, 6/sec)~~ **REMOVED**
2. MediaPreloadQueue (increased: 4 posters, 3 videos concurrent)
3. ConnectionPool (6 connections per host)
4. http1Fetch retry delays

**Problem:** These didn't coordinate. A request would be queued in GlobalRequestManager, then queued again in MediaPreloadQueue, creating double delays.

**FIX APPLIED:** GlobalRequestManager has been completely removed. Now using direct `fetch()` with only MediaPreloadQueue throttling.

### 2. Sequential Loading is Fundamentally Flawed for Feeds
**Current Logic:**
```typescript
if (task.feedIndex > lastCompletedIndex + maxSequentialGap) {
  // Block this task
}
```

**Problem:** 
- If post #0 is slow to load, posts #6, #7, #8 are blocked even if they're visible
- No priority override for visible posts
- No "jump ahead" for user scrolling

**What Should Happen:**
- Visible posts should ALWAYS load first, regardless of index
- Sequential loading should only apply to off-screen preloading
- User scrolling should cancel off-screen tasks and prioritize new visible posts

### 3. Request Deduplication is Too Aggressive
**Current Logic:**
```typescript
if (pendingRequestsByUrl.get(url)) {
  // Attach to existing request
}
```

**Problem:**
- If request #1 fails, request #2 (which was deduplicated) also fails
- No retry on deduplication failure
- Deduplication doesn't account for different request contexts (e.g., thumbnail vs. full video)

### 4. No Progressive Video Loading
**Current:** Load entire 6-second preroll or full video as blob

**Problem:**
- All-or-nothing: if network fails at 5 seconds, you get nothing
- High memory usage (storing blobs)
- Can't play while loading

**Better Approach:**
- Use native video streaming via `<video src="url">`
- Let browser handle chunked transfer
- Use `preload="metadata"` for off-screen, `preload="auto"` for visible
- Range requests (HTTP 206) for progressive loading

### 5. Firebase Storage CORS Issues
**Recurring Error:**
```
Request header field x-forwarded-proto is not allowed by Access-Control-Allow-Headers
```

**Current Fix:** Whitelist of safe headers for Firebase

**Problem:** Firebase Storage has strict CORS. Our aggressive HTTP/1.1 headers (`X-Forwarded-Proto`, `X-Real-IP`, etc.) are being rejected.

**Better Approach:**
- For Firebase URLs, use MINIMAL headers (only `Accept`, `Range`, `User-Agent`)
- Don't force HTTP/1.1 headers on Firebase (they handle it)
- Use signed URLs with tokens for private videos

---

## Why It Was Working Previously

**Before Our "Fixes":**
1. **No GlobalRequestManager:** Requests were not throttled globally
2. **Higher MediaPreloadQueue concurrency:** 4-8 concurrent tasks per type
3. **Larger sequential gap:** 15+ posts ahead
4. **No blocking:** Failures didn't stop progression
5. **Simpler fetch:** Just `fetch()` with basic retry logic

**What Broke It:**
- We added too many "safety" layers thinking they'd help
- We over-optimized for Render.com's limitations
- We tried to solve HTTP/2 errors by over-restricting HTTP/1.1

---

## Recommended Fixes (Priority Order)

### CRITICAL - Immediate Action Required

#### 1. Revert to Simpler Media Loading ⚠️ TOP PRIORITY
**Action:**
```typescript
// MediaPreloadQueue.ts
private readonly CONCURRENCY_LIMITS: ConcurrencyLimits = {
  [TaskType.POSTER]: 4,              // Increase from 1
  [TaskType.VIDEO_PREROLL_6S]: 3,    // Increase from 1
  [TaskType.VIDEO_FULL]: 2,          // Increase from 1
  [TaskType.IMAGE]: 4,               // Increase from 1
  [TaskType.AUDIO_META]: 2,          // Increase from 1
  [TaskType.TEXT_FULL]: 3,           // Increase from 1
  [TaskType.AUDIO_FULL]: 2,          // Increase from 1
};

private readonly SEQUENTIAL_CONFIG: SequentialConfig = {
  maxConcurrentPosters: 4,           // Increase from 2
  maxConcurrentVideos: 3,            // Increase from 2
  maxSequentialGap: 10,              // Increase from 5
  posterBlocksProgression: false,    // Keep disabled
  videoBlocksProgression: false      // Keep disabled
};
```

**Remove all artificial delays in `executeTask`:**
```typescript
// DELETE THIS:
// await new Promise(resolve => setTimeout(resolve, 100));
```

**Why:** These restrictions are strangling the application. Browser can handle way more.

---

#### 2. Loosen GlobalRequestManager ⚠️
**Action:**
```typescript
// GlobalRequestManager.ts
private readonly MAX_CONCURRENT_REQUESTS = 8;  // Increase from 4
private readonly MAX_REQUESTS_PER_SECOND = 12; // Increase from 6
private readonly MIN_REQUEST_DELAY = 50;       // Decrease from 200ms
```

**Why:** Modern browsers can handle 6 concurrent requests per domain. With keep-alive, we can go higher.

---

#### 3. Fix Sequential Loading Logic to Prioritize Visible Posts
**Action:**
```typescript
// MediaPreloadQueue.ts - in canStartTask()
private canStartTask(task: MediaTask): boolean {
  // If task is VISIBLE priority, ALWAYS allow it regardless of sequential gap
  if (task.priority === Priority.VISIBLE) {
    return true; // Visible posts override all sequential restrictions
  }

  // For off-screen preloading, apply sequential gap
  if (task.type === TaskType.POSTER || task.type === TaskType.VIDEO_PREROLL_6S) {
    const currentIndex = Math.max(this.lastCompletedPosterIndex, this.lastCompletedVideoIndex);
    const maxGap = this.SEQUENTIAL_CONFIG.maxSequentialGap;
    
    if (task.feedIndex > currentIndex + maxGap) {
      return false; // Block off-screen tasks that are too far ahead
    }
  }

  // Rest of the checks...
}
```

**Why:** Visible posts should NEVER be blocked by sequential logic. User experience matters more than "perfect" sequential loading.

---

#### 4. Simplify Request Deduplication
**Action:**
```typescript
// GlobalRequestManager.ts - in request()
// DISABLE DEDUPLICATION for video requests or add retry logic
if (url.includes('/api/video')) {
  // Don't deduplicate video requests - each component may need its own
  // OR: On failure, retry deduplicated requests individually
}
```

**Why:** Deduplication is causing cascading failures. Better to have some duplicate requests than all-or-nothing behavior.

---

### HIGH Priority - After Immediate Fixes

#### 5. Implement Progressive Video Loading
**Action:**
Replace blob-based video loading with native streaming:

```typescript
// In NeverBlackVideo.tsx or equivalent
<video
  src={videoUrl}  // Direct URL, not blob
  preload={isVisible ? "auto" : "metadata"}
  crossOrigin="anonymous"
/>
```

**Why:** 
- Native browser handling is more robust
- Progressive loading means users see video sooner
- Lower memory usage
- Better error recovery

---

#### 6. Optimize Firebase Storage Requests
**Action:**
```typescript
// http1Fetch.ts - for Firebase Storage
private createFirebaseHeaders(originalHeaders?: HeadersInit): Record<string, string> {
  return {
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (compatible; CarrotApp/1.0)',
    // ONLY these headers for Firebase - nothing else
  };
}
```

**Why:** Firebase Storage is rejecting our aggressive headers. Minimal headers = fewer CORS errors.

---

#### 7. Add Smart Retry Logic with Circuit Breaker
**Action:**
```typescript
// New file: circuitBreaker.ts
class CircuitBreaker {
  private failures = new Map<string, number>();
  private openUntil = new Map<string, number>();
  
  canAttempt(url: string): boolean {
    const openTime = this.openUntil.get(url);
    if (openTime && Date.now() < openTime) {
      return false; // Circuit is open (too many failures)
    }
    return true;
  }
  
  recordSuccess(url: string) {
    this.failures.delete(url);
    this.openUntil.delete(url);
  }
  
  recordFailure(url: string) {
    const count = (this.failures.get(url) || 0) + 1;
    this.failures.set(url, count);
    
    if (count >= 3) {
      // Open circuit for 30 seconds after 3 failures
      this.openUntil.set(url, Date.now() + 30000);
    }
  }
}
```

**Why:** Prevents repeated requests to failing endpoints, reducing wasted connections.

---

### MEDIUM Priority - Longer Term

#### 8. Consider CDN for Media Assets
**Options:**
- Cloudflare CDN (free tier)
- Cloudinary for image/video optimization
- Firebase CDN (already available)

**Why:** Render.com free tier has connection limits. CDN would offload media serving.

---

#### 9. Implement Adaptive Quality
**Action:**
- Detect slow connections (navigator.connection API)
- Serve lower quality videos for slow connections
- Implement adaptive bitrate streaming (HLS/DASH)

**Why:** One size doesn't fit all. Slow connections need smaller videos.

---

#### 10. Add Better Observability
**Action:**
- Log request timing to see where delays occur
- Track error rates by endpoint
- Monitor memory usage
- User-facing error messages with retry buttons

**Why:** "Loading..." with no feedback is terrible UX. Users need to know what's happening.

---

## What NOT to Do

### ❌ Don't Add More Throttling
We've proven that excessive throttling breaks everything. Adding more layers will only make it worse.

### ❌ Don't Try to Fix HTTP/2 More Aggressively
The custom server is the nuclear option. If that doesn't work, HTTP/2 isn't the real problem.

### ❌ Don't Make Sequential Loading Stricter
`maxSequentialGap: 0` was catastrophic. Don't go back there.

### ❌ Don't Block User Actions
If a user scrolls, cancel off-screen loads immediately and prioritize new visible posts. Never make users wait.

### ❌ Don't Store Large Blobs in Memory
Videos should stream, not download entirely into memory. This will crash on mobile devices.

---

## Testing Plan

### Phase 1: Revert Restrictions (1 hour)
1. Increase MediaPreloadQueue concurrency (4/3/2 for poster/video/full)
2. Increase GlobalRequestManager limits (8 concurrent, 12/sec)
3. Remove all artificial delays
4. Deploy and test

**Success Criteria:** 
- At least 3 videos load in first 10 seconds
- No "stuck" loading states
- HTTP 499 errors reduced by 50%

---

### Phase 2: Fix Sequential Logic (2 hours)
1. Add visible priority override to `canStartTask()`
2. Test with rapid scrolling
3. Verify visible posts always load first

**Success Criteria:**
- Scrolling to post #20 loads it even if post #5 failed
- No cascading failures from early posts

---

### Phase 3: Optimize Headers (1 hour)
1. Simplify Firebase Storage headers (Accept + User-Agent only)
2. Test CORS errors

**Success Criteria:**
- Zero CORS errors for Firebase Storage
- Video thumbnails load consistently

---

### Phase 4: Progressive Loading (4 hours)
1. Replace blob-based loading with native `<video src>`
2. Implement `preload` attribute based on visibility
3. Test on slow connections

**Success Criteria:**
- Videos start playing within 2 seconds of becoming visible
- Smooth playback on 3G connections

---

## Conclusion

**What Went Wrong:**
We over-engineered a solution to HTTP/2 errors and created a system so restrictive it can't function. The `maxSequentialGap: 0` bug was the final straw that broke everything, but the entire architecture was already too fragile.

**The Real Problem:**
Render.com's free tier has connection limits, and we tried to work around it with throttling. But we throttled SO MUCH that normal operation became impossible.

**The Fix:**
1. **Immediate:** Revert restrictions to functional levels
2. **Short-term:** Fix sequential logic to prioritize visible posts
3. **Long-term:** Move to progressive streaming and potentially CDN

**The Lesson:**
Performance optimization is about finding the RIGHT balance, not just adding more restrictions. Every layer of "protection" adds complexity and potential failure points. Sometimes the simple solution (just let the browser do its job) is the best.

---

**Status:** Ready for immediate fixes. Recommended to start with Phase 1 testing immediately.

**Next Steps:**
1. Apply CRITICAL fixes (increase concurrency, remove delays)
2. Deploy to Render.com
3. Monitor error logs for 10 minutes
4. If improved, proceed to HIGH priority fixes
5. If not improved, escalate to considering paid hosting tier or CDN

---

## LATEST FIXES APPLIED (October 7, 2025)

### Phase 1: Remove GlobalRequestManager ✓
**Status:** COMPLETED

**Changes:**
1. Removed `GlobalRequestManager.ts` entirely
2. Updated `http1Fetch.ts` to use native `fetch()` directly
3. Removed GlobalRequestManager from diagnostics API
4. Eliminated request deduplication (was causing cascading failures)

**Reasoning:**
The GlobalRequestManager was a new layer of complexity that added:
- Double queuing (request queued in GlobalRequestManager, then MediaPreloadQueue)
- Request deduplication that caused single failures to affect multiple requests
- Artificial delays (50-200ms between ALL requests)
- Complex prioritization logic that conflicted with MediaPreloadQueue

By removing it, we've simplified the architecture back to basics:
- MediaPreloadQueue handles media-specific throttling
- ConnectionPool handles HTTP/1.1 connection reuse
- http1Fetch handles protocol forcing and retries
- **No global throttling layer fighting with media-specific logic**

### Phase 2: Loosen MediaPreloadQueue Restrictions ✓
**Status:** COMPLETED

**Changes:**
1. Increased concurrency limits:
   - Posters: 1 → 4
   - Videos: 1 → 3
   - Images: 1 → 4
   - Other types: 1 → 2-3
2. Increased sequential gap: 5 → 10 posts
3. Removed 100ms artificial delay in `executeTask()`
4. Added VISIBLE priority bypass in `canStartTask()`

**Reasoning:**
The ultra-conservative "1 concurrent request per type" was strangling the application. Modern browsers can easily handle 6+ concurrent requests per domain with HTTP/1.1 keep-alive. By allowing 3-4 concurrent media requests, we enable:
- Multiple posters loading simultaneously
- Parallel video preloading
- Faster initial page load
- Better user experience when scrolling

The VISIBLE priority bypass is **critical**: if a user scrolls to post #20, it should load IMMEDIATELY, even if post #5 failed. User experience trumps perfect sequential loading.

### Expected Results

**Immediate improvements:**
- Videos should load 3x faster (3 concurrent vs 1)
- Posters should load 4x faster (4 concurrent vs 1)
- Visible posts bypass all sequential restrictions
- No artificial delays slowing down loading

**Potential issues to watch:**
- HTTP 499 errors may return if browser connection limits are still exceeded
- ERR_CONNECTION_CLOSED may persist (Render.com free tier issue)
- Firebase CORS errors should be resolved (minimal headers)

**If issues persist:**
The problem is likely NOT the code, but:
1. Render.com free tier connection instability
2. Browser connection limits (unlikely with only 3-4 concurrent)
3. Network issues between client and Render.com
4. Need for CDN or paid hosting tier

### Next Steps if This Doesn't Work

1. **Add diagnostic logging:** Track exactly where requests are failing
2. **Consider CDN:** Offload media serving from Render.com
3. **Implement progressive video loading:** Stream videos instead of blob-based loading
4. **Upgrade hosting:** Render.com paid tier or switch to Vercel/Netlify
5. **Simplify video format:** Ensure videos are web-optimized (H.264, MP4)

---

*Report prepared by AI Assistant analyzing complete codebase and error logs*
*Latest update: Removed GlobalRequestManager, loosened MediaPreloadQueue restrictions*

