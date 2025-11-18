# Deep-Link Crawler Production Fixes

## Summary

Fixed critical issues in the production deep-link crawler to ensure reliable discovery and content extraction.

## ✅ Completed Fixes (8/10)

All critical production fixes are complete!

### A. Register "direct" Provider ✅
**File**: `carrot/src/lib/discovery/orchestrator.ts`
- Added case for `'direct'` source in `fetchUrls()` method
- Routes direct seeds to HTTP fetcher pipeline
- **Acceptance**: No more "Unknown source: direct" errors in logs

### B. Guaranteed Query Expansion ✅
**File**: `carrot/src/lib/discovery/queryExpander.ts`
- Always emits ≥10 seeds per cycle using fallback templates
- Fallback queries include:
  - Site-specific: `site:espn.com {topic}`, `site:nba.com {topic}`, etc.
  - Topic variants: `{topic} controversy`, `{topic} history`, etc.
- Configurable via `CRAWL_MIN_SEEDS_PER_CYCLE` (default: 10)
- **Acceptance**: Frontier shows ≥10 fresh seeds within first loop

### C. JS-Capable Fetch + Extract ✅
**File**: `carrot/src/lib/discovery/renderer.ts` (new)
**File**: `carrot/src/lib/discovery/engineV21.ts`
- Added Playwright renderer for JS-driven sites (nba.com, theathletic.com, etc.)
- Auto-detects JS sites by domain pattern or content length (< 5k bytes, < 100 chars text)
- Playwright settings:
  - Headless chromium
  - Network idle (2 inflight)
  - 12s nav timeout; 16s hard cap
  - Blocks images/video/fonts
- Extraction: Readability-like algorithm with largest-text-block fallback
- **Acceptance**: nba.com articles produce non-empty content (>600 chars)

**Note**: Requires `npm install playwright && npx playwright install chromium` and `CRAWL_RENDER_ENABLED=true`

### D. Wikipedia Dedupe Rework ✅
**File**: `carrot/src/lib/discovery/engineV21.ts`
- Wikipedia pages extract outlinks BEFORE being marked as seen
- Extracts up to 25 outlinks (configurable via `CRAWL_WIKI_OUTLINK_LIMIT`)
- Marks as `seed_processed=true` after outlink extraction
- **Acceptance**: Wiki seeds yield multiple outbound deep links before being skipped

### E. Fair-Use Quoting + Paraphrase Summary ✅
**Files**: 
- `carrot/src/lib/discovery/fairUse.ts` (new)
- `carrot/src/lib/discovery/paraphrase.ts` (new)
- `carrot/src/lib/discovery/engineV21.ts`

- Extracts up to 2 contiguous paragraphs (max ~250-300 words)
- Stores as `quoteHtml`, `quoteText`, `quoteWordCount`, character offsets
- Generates 3-5 paraphrase bullet points (no verbatim > 10 words)
- Stored in `metadata` JSON field and enhanced `quotes` array
- **Acceptance**: Saved records include `quote_html` (≤2 paragraphs) + `summary_points`

### H. Environment Variables ✅
**File**: `carrot/CRAWLER_ENV.md`
- Added new env vars:
  - `CRAWL_RENDER_ENABLED` (default: false)
  - `CRAWL_RENDER_TIMEOUT_MS` (default: 16000)
  - `CRAWL_MIN_SEEDS_PER_CYCLE` (default: 10)
  - `CRAWL_WIKI_OUTLINK_LIMIT` (default: 25)
  - `CRAWL_SEEN_TTL_DAYS` (default: 7)
  - `CRAWL_RETRY_SOFTFAIL` (default: true)
  - `CRAWLER_MAX_RESEED_ATTEMPTS` (default: 10, raised from 3)

### G. Structured JSON Logging ✅
**File**: `carrot/src/lib/discovery/engineV21.ts`
- Every URL logs single JSON line with:
  - `run_id`, `step`, `url`, `source`, `status`
  - `http_status`, `paywall` (bool), `robots` ("allowed"|"disallow")
  - `render_used` (bool), `html_bytes`, `text_bytes`
  - `failure_reason` ("http_error"|"paywall_blocked"|"robots_disallow"|"render_timeout"|"extractor_empty"|"other")
  - `duration_ms`
- Cycle metrics logged for discovery loop
- **Acceptance**: All URL processing visible in structured logs

### F. Persistent Frontier & Fast Skips ✅
**Files**: 
- `carrot/src/lib/redis/discovery.ts`
- `carrot/src/lib/discovery/engineV21.ts`

- Enhanced `isSeen()` to track `last_crawled_at` timestamps in Redis
- Fast skip URLs crawled < 24h ago (configurable via `fastSkipHours`)
- Tracks fast skips in first 10 candidates to prevent >5s re-evaluation
- **Acceptance**: Second run starts pushing beyond first 10 seen URLs within first loop

## 🔄 Optional Tasks

### I. Database Migration (Optional)
- Currently storing quote/summary in `metadata` JSON field (works fine)
- Can add dedicated columns later if needed:
  - `quote_html TEXT`
  - `quote_word_count INT`
  - `summary_points JSONB`
  - `publisher TEXT`
  - `author TEXT`
  - `published_at TIMESTAMPTZ`

### J. Test Plan
1. Run topic = "Chicago Bulls"
   - Verify ≥10 seeds in first cycle
   - Ensure nba.com article yields >600 chars with quote_html
   - Verify paraphrase bullets saved
2. Re-run discovery twice in 10 minutes
   - Confirm fast skip of seen URLs
   - Confirm zero "Unknown source: direct"
3. Check logs for failure_reason distribution
4. Manual spot-check: verify quote_html ≤ 2 paragraphs, summary is paraphrase

## 🚀 Deployment Steps

1. **Install Playwright** (if using renderer):
   ```bash
   npm install playwright
   npx playwright install chromium
   ```

2. **Set Environment Variables**:
   ```bash
   CRAWL_RENDER_ENABLED=true
   CRAWL_MIN_SEEDS_PER_CYCLE=10
   CRAWL_WIKI_OUTLINK_LIMIT=25
   CRAWLER_MAX_RESEED_ATTEMPTS=10
   ```

3. **Deploy and Test**:
   - Push to production
   - Run discovery for "Chicago Bulls"
   - Monitor logs for structured JSON output
   - Verify no "Unknown source: direct" errors
   - Check that articles include quote_html and summary_points

## 📊 Key Metrics to Monitor

- `new_enqueues` per cycle (should be ≥10)
- `extractor_empty` count (should be 0 for nba.com)
- `render_success` vs `render_failed` ratio
- `wiki_outlinks_enqueued` count
- `failure_reason` distribution in logs

## 🐛 Known Issues / Notes

- Playwright renderer requires browser binaries (~300MB)
- Wikipedia outlink extraction happens before seen check (intentional)
- Fair-use quotes stored in both `quotes` array and `metadata` field
- Paraphrase summary is heuristic-based (can be enhanced with LLM later)

