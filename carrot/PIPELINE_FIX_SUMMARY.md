# Pipeline Fix Summary - Implementation Status

This document summarizes the implementation of the pipeline fixes to address the "stuck" frontend issue.

## ✅ Completed Fixes

### 1. **Feature Flags** ✅
- **File**: `src/lib/config/features.ts`
- **Changes**: Added pipeline feature flags (static seeds, render branch, new API shape, hero threshold)
- **Default**: ON for `chicago-bulls`, OFF for others
- **Usage**: Controlled via `PATCH_FEATURES` env var

### 2. **Seed Fallback & Floor** ✅
- **Files**: 
  - `src/lib/discovery/staticSeeds.ts` (new)
  - `src/lib/discovery/planner.ts`
  - `src/lib/discovery/config.ts`
- **Changes**:
  - Set `MIN_UNIQUE_DOMAINS=3` (was 5)
  - Added static Bulls seeds (10+ vetted NBA/Bulls domains)
  - Planner never aborts - always proceeds even with low diversity
  - Logs `seed_fallback_applied: true` when static seeds are used
- **Acceptance**: Discovery never logs "minimum domains X not met"

### 3. **Playwright Render Branch** ✅
- **File**: `src/lib/discovery/headlessFetcher.ts`
- **Changes**:
  - Enhanced Branch 4 (Playwright) with:
    - UA rotation (desktop/mobile)
    - Block fonts/media/analytics
    - Cap images at 2MB
    - `waitUntil: 'networkidle'`
    - 15s timeout cap
    - Close context per URL to stop leaks
    - `--disable-dev-shm-usage` flag
- **Acceptance**: Logs show `render_used:true` for paywalled/403 pages

### 4. **Canonicalization & Duplicate Check** ✅
- **Files**:
  - `src/lib/discovery/canonicalize.ts`
  - `src/lib/discovery/engineV21.ts`
- **Changes**:
  - Added `canonicalHost` and `canonicalPathHash` (SHA-256) to canonicalization
  - DB-first duplicate check: check `(patchId, canonicalUrl)` before create
  - Compute `contentHash = sha256(cleanedText)` for content deduplication
  - Skip hero regen if `contentHash` unchanged on recrawl
- **Acceptance**: No more `duplicate_simhash` logs; duplicates short-circuited via DB unique

### 5. **Save → Hero Transaction** ✅
- **File**: `src/lib/discovery/engineV21.ts`
- **Changes**:
  - Transactional upsert: save content and create hero in same transaction
  - `MIN_TEXT_BYTES_FOR_HERO` threshold (default 600, configurable via env)
  - Explicit logs: `saved:true hero:true/false status:SAVED/ERROR`
  - Persist `textBytes`, `htmlBytes`, `lastFetchedAt`
  - Set `status='ERROR'` and `lastError` if hero fails
- **Acceptance**: Logs per item include `saved:true`, `hero:true|false`, `status:SAVED|ERROR`

### 6. **New `/discovered-content` API Shape** ✅
- **File**: `src/app/api/patches/[handle]/discovered-content/route.ts`
- **Changes**:
  - New response shape: `{ success, items, cursor, hasMore, totals, isActive, debug }`
  - Cursor pagination with `buildSha` and `patchId` in keys
  - `Cache-Control: no-store`, `Vary: Authorization`
  - Order by `createdAt desc, id desc`
  - Never 500; return `{success:false, error:{code,msg}}`
  - Debug includes `buildSha`, `lastRunId`, `reasonWhenEmpty`
- **Acceptance**: FE receives `buildSha` & `lastRunId`; pagination works; no 500s

### 7. **Backfill Script** ✅
- **File**: `scripts/backfill-heros.ts` (new)
- **Features**:
  - Re-extract where `textContent empty` or status errors
  - Batch processing (25 items per batch)
  - Concurrency limit (5)
  - Resume support via `--resume-from`
- **Usage**: `tsx scripts/backfill-heros.ts --patch=chicago-bulls --limit=200`

## ⏳ Remaining Tasks

### 8. **FE Components** (Pending)
- **Files**: 
  - `src/app/(app)/patch/[handle]/components/LiveCounters.tsx`
  - `src/app/(app)/patch/[handle]/components/DiscoveryList.tsx`
  - `src/app/(app)/patch/[handle]/components/LivePanel.tsx`
- **Required Changes**:
  - `LiveCounters`: Count by `status` from DB (or cached), not "run"
  - `DiscoveryList`: Use new API shape; keys include `patchId`, `cursor`, `buildSha`; show `debug.reasonWhenEmpty`; abort controllers on route change
  - `LivePanel`: Wire "Sync Saved → Heroes" endpoint; disable button in-flight; poll results; invalidate list + counters on completion

### 9. **Observability & Alerts** (Pending)
- **Required**:
  - Prom metrics: `dc_extractions_total{status}`, `dc_bytes_text_total`, `dc_paywall_total`, `dc_render_time_seconds`
  - API p95 for `/discovered-content` & `/sync-saved-to-heroes`
  - Alerts: SAVED==0 for 15m, error rate >30%, render p95>12s, API p95>500ms

## Environment Variables

Set these for the fixes to work:

```bash
MIN_UNIQUE_DOMAINS=3
MIN_TEXT_BYTES_FOR_HERO=600
PER_DOMAIN_RPS=2
RUN_TIMEOUT_SEC=300
DISCOVERY_LIMIT_PER_PAGE=50
PLAYWRIGHT_BROWSERS_PATH=0
PATCH_FEATURES=static_seeds,render,new_api,hero_threshold  # For chicago-bulls
```

## Acceptance Tests

1. **Seed fallback**: Start discovery on `chicago-bulls`. Expect: "seed_fallback_applied: true", ≥10 unique seeds.
2. **Render branch**: Hit a known-paywall or bball-ref page. Expect: `branchUsed:"render", render_used:true, textBytes>0`.
3. **API shape**: After run completes, FE shows updated counters, at least 1 **new hero**, and **no 500s**. API returns debug with `buildSha` + `lastRunId`.
4. **Backfill**: Trigger backfill; see ≥50 historic items hero'd.

## Notes

- The FE components and observability are marked as pending but are not blocking for the core pipeline fixes
- The backend changes are complete and should resolve the "stuck" frontend issue
- All changes maintain backward compatibility where possible

