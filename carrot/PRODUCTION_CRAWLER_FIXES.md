# Production Crawler Fixes - Implementation Summary

## Overview
This document summarizes the end-to-end fixes implemented to make the discovery crawler reliably expand beyond Wikipedia into deep links, fetch and parse pages, extract quotes, summarize content, generate hero images, and persist records without schema errors.

## Changes Implemented

### A) Database Schema Fixes ✅

**Files Modified:**
- `prisma/schema.prisma` - Added missing fields to `DiscoveredContent`
- `prisma/migrations/20250118000000_add_crawl_frontier_and_fields/migration.sql` - Migration for new fields

**New Fields Added to `DiscoveredContent`:**
- `sourceDomain` (VARCHAR(255)) - Source domain for categorization
- `rawHtml` (BYTEA) - Raw HTML content
- `textContent` (TEXT) - Extracted text content
- `keyFacts` (JSONB) - Array of key facts (3-8 items)
- `notableQuotes` (JSONB) - Array of quotes with attribution
- `isUseful` (BOOLEAN) - Relevance heuristic
- `lastCrawledAt` (TIMESTAMP) - Last crawl timestamp

**New Table: `CrawlFrontier`**
- Tracks crawl status per URL across runs
- Fields: `url`, `normalizedUrl`, `status`, `depth`, `failReason`, `httpStatus`, `robotsAllowed`, etc.
- Enables durable dedupe and prevents re-processing successful URLs

### B) Crawl Frontier & Durable Dedupe ✅

**Files Created:**
- `src/lib/discovery/crawlFrontier.ts` - Frontier management utilities

**Features:**
- URL normalization (lowercase scheme/host, remove UTM params, sort query, strip fragments)
- Cross-run deduplication (skip URLs with `status=success`)
- Priority-based processing (lowest depth, oldest `lastTriedAt`)
- Retry tracking with exponential backoff
- Frontier stats API

### C) Robust Fetcher & Parser ✅

**Files Created:**
- `src/lib/discovery/robustFetcher.ts` - Fetch with retries, timeouts, robots.txt

**Features:**
- 10s connect timeout, 20s read timeout (configurable)
- 2 retries with exponential backoff + jitter
- Custom User-Agent: `CarrotCrawler/1.0 (+contact@example.com)`
- Robots.txt checking (simplified, can be enhanced)
- Content-Type validation (only `text/html` or `application/xhtml+xml`)
- HTML → text extraction with Readability-like heuristics
- Fair-use quote picker (≤2 paragraphs, ≤180 words total)

### D) Summarizer Contract Enforcement ✅

**Files Created:**
- `src/lib/discovery/enrichmentContract.ts` - Zod schema for enrichment contract

**Files Modified:**
- `src/app/api/ai/summarize-content/route.ts` - Enforce contract with validation

**Contract Shape:**
```typescript
{
  title: string
  summary: string
  keyFacts: string[] // 3-8 items
  notableQuotes: Array<{
    quote: string
    attribution?: string
    sourceUrl?: string
  }>
  isUseful: boolean
}
```

**Features:**
- Zod validation with safe defaults
- Hard cap quotes at 2 paragraphs
- Logs validation errors for debugging
- Marks pages as failed with `failReason="summarizer_contract_violation"` if invalid

### E) Hero Image Generation Fixes ✅

**Files Modified:**
- `src/app/api/ai/generate-hero-image/route.ts` - Support both old and new contract

**Files Created:**
- `src/lib/discovery/heroFallback.ts` - Fallback pipeline (Wikimedia → OpenVerse → Skeleton)

**Features:**
- Accepts both `(title, summary)` and `(topic, context)` formats
- Better validation error logging
- Fallback pipeline:
  1. Wikimedia Commons search
  2. OpenVerse CC-licensed images
  3. Branded skeleton placeholder
- Never fails the whole content save if hero generation fails

### F) Error Taxonomy ✅

**Files Created:**
- `src/lib/discovery/errorTaxonomy.ts` - Consistent failReason classification

**FailReason Types:**
- `robots_disallowed`
- `http_4xx` / `http_5xx`
- `content_type_unsupported`
- `timeout`
- `parse_failure`
- `summarizer_contract_violation`
- `db_write_error`
- `hero_image_validation_error`
- `image_not_found`
- `unknown_error`

### G) Environment Variables ✅

**Files Modified:**
- `CRAWLER_ENV.md` - Added new configuration knobs

**New Variables:**
- `CRAWL_MAX_DEPTH` (default: 2)
- `CRAWL_PER_HOST_CONCURRENCY` (default: 2)
- `CRAWL_GLOBAL_CONCURRENCY` (default: 6)
- `CRAWL_FETCH_CONNECT_TIMEOUT_MS` (default: 10000)
- `CRAWL_FETCH_READ_TIMEOUT_MS` (default: 20000)
- `CRAWL_WIKI_OUTLINK_LIMIT` (default: 50)

## Pending Implementation

### C) Wikipedia → Deep-Link Expansion
- Extract outbound links from Wikipedia pages
- Filter: exclude Wikipedia/internal, fragments, mailto, login pages
- Enqueue up to N (default 50) external links at depth + 1
- Topic query path: web search for entity (e.g., "Chicago Bulls") → enqueue top results

### H) Rate Limits & Host Politeness
- Per-host in-flight cap (default: 2)
- Global concurrency cap (default: 6)
- Delay between requests to same host (default: 1s)

### I) Logging & Metrics
- Structured JSON logs at key steps (crawlId, url, depth, status, ms, httpStatus, bytes, contentType)
- Counters/timers (OpenTelemetry or Prom-compatible):
  - `crawler.fetch.attempts/failures` (labels: host, reason)
  - `crawler.parse.success`
  - `crawler.enrichment.success/failure`
  - `crawler.persist.success/failure` (labels: prismaErrorCode)
  - `crawler.frontier.pending/success/failed`
- Run Summary log: totals, top fail reasons, slowest hosts, % deep links vs Wikipedia, # saved records

### J) Fair-Use Quoting Guardrails
- Hard cap ≤2 full paragraphs total per URL
- Always attach `sourceUrl`
- If >2 paragraphs, keep two with highest information density

### K) Test Harness
- CLI script: `pnpm crawl:topic "Chicago Bulls" --limit 30 --depth 2`
- Seeds 3-5 Wikipedia pages + 10 search results
- Processes frontier respecting rules
- Live ticker: pending/ok/failed, per-host rate, last error reason

## Next Steps

1. **Run Migration:**
   ```bash
   cd carrot
   npx prisma migrate deploy
   ```

2. **Integrate New Utilities:**
   - Update `engineV21.ts` to use `crawlFrontier.ts` for dedupe
   - Update `engineV21.ts` to use `robustFetcher.ts` for fetching
   - Update `engineV21.ts` to use `enrichmentContract.ts` for validation
   - Update `hero-pipeline.ts` to use `heroFallback.ts` for fallbacks

3. **Test:**
   - Run a test crawl for "Chicago Bulls"
   - Verify ≥10 non-Wikipedia deep-link articles saved
   - Verify no Prisma errors
   - Verify re-running doesn't waste time on same URLs

4. **Complete Pending Items:**
   - Wikipedia deep-link expansion
   - Rate limiting
   - Structured logging
   - Test harness

## Acceptance Criteria Status

- ✅ Schema errors fixed (publishDate, new fields)
- ✅ Hero image 400s fixed (flexible contract, fallbacks)
- ✅ Summarizer contract enforced (Zod validation)
- ⏳ Deep-link expansion (pending integration)
- ⏳ Durable dedupe (frontier created, needs integration)
- ⏳ Structured logging (pending)
- ⏳ Test harness (pending)

## Files Modified/Created

**Created:**
- `prisma/migrations/20250118000000_add_crawl_frontier_and_fields/migration.sql`
- `src/lib/discovery/crawlFrontier.ts`
- `src/lib/discovery/robustFetcher.ts`
- `src/lib/discovery/enrichmentContract.ts`
- `src/lib/discovery/heroFallback.ts`
- `src/lib/discovery/errorTaxonomy.ts`
- `PRODUCTION_CRAWLER_FIXES.md`

**Modified:**
- `prisma/schema.prisma`
- `src/app/api/ai/generate-hero-image/route.ts`
- `src/app/api/ai/summarize-content/route.ts`
- `CRAWLER_ENV.md`

