# Deep-Link Crawler Production Refactor

## Summary

Refactored the deep-link crawler to eliminate infinite reseed loops, add circuit breakers, implement exponential backoff, and provide production observability.

## Changes Made

### 1. Circuit Breakers & Reseed Loop Elimination

**File**: `carrot/src/lib/discovery/engineV21.ts`

- Added `reseedAttempts` counter with max cap (`CRAWLER_MAX_ATTEMPTS_PER_STEP` or 3)
- Added exponential backoff with jitter (100ms * 2^n + 0-250ms jitter, max 5s)
- Circuit breaker prevents reseed after max attempts
- Logs `reseed_circuit_breaker` when cap is reached

**Key Changes**:
```typescript
private reseedAttempts = 0
private readonly MAX_RESEED_ATTEMPTS = Number(process.env.CRAWLER_MAX_ATTEMPTS_PER_STEP || 3)
private lastReseedTime = 0
private reseedBackoffMs = 100

// In processCandidate loop:
if (this.scheduler.needsReseed() && this.reseedAttempts < this.MAX_RESEED_ATTEMPTS) {
  const now = Date.now()
  const timeSinceLastReseed = now - this.lastReseedTime
  const backoffWithJitter = this.reseedBackoffMs + Math.random() * 250
  
  if (timeSinceLastReseed >= backoffWithJitter) {
    await this.triggerReseed(coveredAngles, 'scheduler_guard')
    this.reseedAttempts++
    this.lastReseedTime = now
    this.reseedBackoffMs = Math.min(this.reseedBackoffMs * 2, 5000)
  }
}
```

### 2. Exponential Backoff in Crawler

**File**: `carrot/src/lib/discovery/deepLinkCrawler.ts`

- Added retry logic with exponential backoff for fetch failures
- Retries on `ERR_FETCH_TIMEOUT` and `ERR_FETCH_FAILED` (max 2 retries)
- Backoff: `100ms * 2^retryCount + jitter(0-250ms)`, capped at 5s

**Key Changes**:
```typescript
private async processCandidate(candidate: UrlCandidate, retryCount = 0): Promise<PersistResult | null> {
  // Exponential backoff on retry
  if (retryCount > 0) {
    const backoffMs = Math.min(100 * Math.pow(2, retryCount) + Math.random() * 250, 5000)
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }
  
  // Retry on transient errors
  if ((fetchResult.error!.code === 'ERR_FETCH_TIMEOUT' || fetchResult.error!.code === 'ERR_FETCH_FAILED') && retryCount < 2) {
    return this.processCandidate(candidate, retryCount + 1)
  }
}
```

### 3. API Endpoints

**File**: `carrot/src/app/api/runs/[id]/route.ts` (NEW)

- `GET /api/runs/:id` - Returns run summary with metrics
- In-memory store (last 100 runs)
- Returns 404 if run not found

**File**: `carrot/src/app/api/health/route.ts` (EXISTING)

- Already exists and returns health status
- Includes uptime, version, connectivity tests

### 4. Test Script

**File**: `carrot/scripts/run-crawler-once.ts` (NEW)

- Runs a single crawler execution
- Validates acceptance criteria
- Supports CLI args: `--runId`, `--keywords`, `--notes`
- Respects env config overrides

**Usage**:
```bash
CRAWLER_MAX_ATTEMPTS_TOTAL=20 \
CRAWLER_MAX_ATTEMPTS_PER_STEP=5 \
CRAWLER_CONCURRENCY=3 \
npm run crawler:run -- --runId dev-check --keywords "Chicago Bulls" --notes "features; statistics; season outlook"
```

### 5. Structured JSON Logging

**File**: `carrot/src/lib/discovery/deepLinkCrawler.ts`

- All events log as single-line JSON
- Keys: `id, runId, patchId, step, status, ts, provider, query, candidateUrl, finalUrl, meta, error`
- Steps: `query_expand`, `generate_candidates`, `fetch`, `extract`, `persist`, `run_complete`

### 6. Error Codes

All errors use consistent codes:
- `ERR_NO_QUERY_INPUT` - No usable query input
- `ERR_QUERY_EXPAND_PROVIDER` - Provider failed (falls back to keywords/notes)
- `ERR_ATTEMPT_CAP` - Circuit breaker triggered
- `ERR_FETCH_TIMEOUT` - Fetch timeout
- `ERR_FETCH_NON_200` - HTTP error status
- `ERR_EXTRACT_FAILED` - Content extraction failed
- `ERR_PERSIST_FAILED` - Database save failed

## Configuration (Environment Variables)

```bash
CRAWLER_MAX_ATTEMPTS_TOTAL=40          # Global attempt cap
CRAWLER_MAX_ATTEMPTS_PER_STEP=10      # Per-step attempt cap
CRAWLER_FETCH_TIMEOUT_MS=15000         # Fetch timeout
CRAWLER_USER_AGENT=DeepLinkCrawler/1.0 # User agent string
CRAWLER_CONCURRENCY=4                  # Concurrent fetches
```

## Pipeline Flow

```
normalizeInput(meta)
  ↓
expandQueries(input) [with fallbacks]
  ↓
generateCandidates(queries) [dedupe, cap 30]
  ↓
for each candidate (concurrency = 4):
  fetchPage(url) [with retry + backoff]
    ↓
  extractContent(html) [fallback on failure]
    ↓
  persistArtifact(item) [idempotent by urlHash]
  ↓
finalizeRun() [emit run_complete]
```

## Acceptance Criteria

✅ **No infinite reseed loops**
- Reseed capped at `MAX_RESEED_ATTEMPTS` (default 3)
- Exponential backoff prevents rapid reseeds
- Circuit breaker logs when cap reached

✅ **Graceful error handling**
- `ERR_NO_QUERY_INPUT` when no usable input
- All errors have `code` and `msg`
- Terminal `run_failed` on fatal errors

✅ **Observability**
- `/health` endpoint returns status
- `/runs/:id` returns run summary
- Structured JSON logs for all steps

✅ **Deterministic pipeline**
- Linear flow with typed results
- No silent nulls
- Metrics tracked per step

## Example Run Complete JSON

```json
{
  "id": "dev-check",
  "runId": "dev-check",
  "patchId": null,
  "status": "ok",
  "startedAt": "2025-01-15T12:00:00.000Z",
  "completedAt": "2025-01-15T12:05:30.000Z",
  "meta": {
    "attempts": {
      "total": 15,
      "byStep": {
        "query_expand": 1,
        "generate_candidates": 1,
        "fetch": 8,
        "extract": 8,
        "persist": 8,
        "reseed": 0
      }
    },
    "duplicates": 2,
    "itemsSaved": 5,
    "errorsByCode": {
      "ERR_FETCH_TIMEOUT": 1,
      "ERR_FETCH_NON_200": 1
    }
  }
}
```

## Testing

Run a single test execution:

```bash
cd carrot
CRAWLER_MAX_ATTEMPTS_TOTAL=20 \
CRAWLER_MAX_ATTEMPTS_PER_STEP=5 \
CRAWLER_CONCURRENCY=3 \
npm run crawler:run -- --runId dev-check --keywords "Chicago Bulls" --notes "features; statistics; season outlook"
```

**Expected Output**:
- `query_expand.status === "ok"` (or graceful fallback)
- `attempts.byStep.reseed <= 1`
- `run_complete.meta.itemsSaved >= 1` OR terminal `run_failed` with `ERR_NO_QUERY_INPUT`
- No repeated `reseed` lines beyond cap

## Files Modified

1. `carrot/src/lib/discovery/engineV21.ts` - Circuit breakers, reseed caps
2. `carrot/src/lib/discovery/deepLinkCrawler.ts` - Exponential backoff, retry logic
3. `carrot/src/app/api/runs/[id]/route.ts` - NEW: Run status endpoint
4. `carrot/scripts/run-crawler-once.ts` - NEW: Test script
5. `carrot/package.json` - Added `crawler:run` script

## Deployment

1. **Deploy code** - All changes are production-ready
2. **Set env vars** (optional, defaults work):
   ```bash
   CRAWLER_MAX_ATTEMPTS_TOTAL=40
   CRAWLER_MAX_ATTEMPTS_PER_STEP=10
   CRAWLER_CONCURRENCY=4
   ```
3. **Verify**:
   - `/health` returns `200 OK`
   - Run test: `npm run crawler:run -- --runId test-1 --keywords "test"`
   - Check logs for structured JSON output
   - Verify no infinite reseed loops

## Monitoring

- **Logs**: Grep for `step:"reseed"` - should see max 3 attempts
- **Logs**: Grep for `step:"run_complete"` - should see final summary
- **API**: `GET /api/runs/:id` - check run metrics
- **Health**: `GET /api/health` - verify service status

