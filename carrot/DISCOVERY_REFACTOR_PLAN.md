# Discovery/Crawler Refactor Plan

## Overview
Refactor the discovery system to find and fetch REAL deep links (beyond Wikipedia), persist raw content, and extract structured information via LLM.

## Goals
- Find and fetch deep links from non-Wikipedia sources
- Persist raw HTML + extracted text
- Extract via LLM: title, 10 facts, 2 quoted paragraphs, paraphrase summary
- Avoid re-processing same URLs/content across runs
- Strong logging, metrics, and "why zero results?" dashboard

---

## Implementation Phases

### Phase 1: Foundation (Database & Infrastructure)
**Dependencies**: None

1. ✅ **Database Migrations**
   - Create `pages` table: url (unique), domain, status, first_seen_at, last_processed_at, text_hash, bytes, http_status, reason_code
   - Create `extractions` table: page_id, topic, source_url, title, top_10_facts (JSON), quoted_passages (JSON), paraphrase_summary, controversial_flags (JSON), metadata (JSON)
   - Make migrations idempotent

2. ✅ **Redis Infrastructure**
   - Implement `seen:url:<hash>` set with 7-14 day TTL
   - Helper functions: `markUrlSeen(url, ttl)`, `isUrlSeen(url)`
   - Add to existing Redis discovery utilities

3. ✅ **Content Deduplication**
   - SHA-256 hash over cleaned text
   - Check `text_hash` in Postgres before processing
   - Skip if hash exists

### Phase 2: Crawler Enhancements
**Dependencies**: Phase 1

4. ✅ **Outlink Extraction & Enqueue**
   - Extract outlinks from fetched pages
   - Normalize URLs (canonicalize, remove fragments, sort query params)
   - Calculate priority scores
   - Enqueue to `discovery_queue` with priority

5. ✅ **Priority Scoring System**
   - Base domain score (configurable per domain)
   - Path depth bonus (deeper = higher priority)
   - Article regex bonus: `/\d{4}\/\d{2}\/|\/\d{4}\/|\/news\/|\/article\/|\/story\/|\/sports\//`
   - Wikipedia penalty: downrank after first 2 pages per run
   - Duplicate penalty: reduce priority for previously failed URLs
   - Domain diversity: max 4 from same domain per 20 dequeues

6. ✅ **Robots.txt & Error Handling**
   - Check robots.txt before fetching
   - Structured reason codes: `robots_blocked`, `timeout`, `dns_error`, `http_403`, `paywall`, `content_too_short`
   - Respect timeouts (existing FETCH_TIMEOUT_MS)

7. ✅ **Raw Content Persistence**
   - Save raw HTML to `pages` table
   - Save extracted text
   - Save canonical URL
   - Save final status and reason_code

### Phase 3: Queue System
**Dependencies**: Phase 1, Phase 2

8. ✅ **Discovery Queue**
   - Redis-based priority queue for URLs to fetch
   - Durable ack/retry with exponential backoff
   - Dead-letter queue for final failures with reason_code
   - Track queue depth (gauge metric)

9. ✅ **Extraction Queue**
   - Redis-based queue for `page_id` to extract
   - Send to LLM extractor
   - Durable ack/retry with exponential backoff
   - Track queue depth (gauge metric)

### Phase 4: LLM Extractor
**Dependencies**: Phase 1, Phase 3

10. ✅ **LLM Extractor Service**
    - DeepSeek API integration (or equivalent)
    - Input: `{topic, url, domain, text, crawl_timestamp}`
    - Output: Validated JSON per schema
    - Retry with smaller chunk if payload too large
    - Persist to `extractions` table
    - Emit NDJSON line for downstream use

11. ✅ **Prompt Templates**
    - **System Message**: "You are a precise research summarizer. Use only the provided page text and URL. Do not invent facts. Return valid JSON per the provided schema. Include up to TWO full quoted paragraphs VERBATIM with quotation marks and line breaks preserved. All other sections must be paraphrased. If content is thin or paywalled, return a structured error with 'insufficient_content'."
    - **User Template**: 
      ```
      Topic: {{topic}}
      Source URL: {{url}}
      Instructions:
      - Give an engaging title.
      - List the 10 most interesting facts (mix historical + controversial where applicable).
      - Include up to 2 full, verbatim quoted paragraphs from the source (not summary text).
      - Provide a concise paraphrase summary (no quotes).
      - Return the exact JSON schema.
      ```

12. ✅ **JSON Schema Validation**
    - Use zod or ajv to validate LLM output
    - Schema:
      ```typescript
      {
        topic: string
        source_url: string
        title: string
        top_10_facts: string[]
        quoted_passages: Array<{quote: string, context_note: string}>
        paraphrase_summary: string
        controversial_flags?: string[]
        metadata: {domain: string, crawl_timestamp: string, char_count: number}
      }
      ```

### Phase 5: Topic Seeding
**Dependencies**: Phase 2

13. ✅ **Discovery Starter**
    - High-signal hub queries: `"<topic> site:espn.com OR site:theathletic.com OR site:nbcchicago.com OR site:nba.com"`
    - Generic Google/Bing queries (if API keys available)
    - Curated seed list fallback
    - High-yield domain priority list
    - Per-domain concurrency cap (2-3)

### Phase 6: Observability
**Dependencies**: Phase 2, Phase 3, Phase 4

14. ✅ **Structured Logging**
    - JSON logs with fields: `ts, service, step, url, domain, action, status, http_status, reason_code, duration_ms, bytes, text_len, queue_size, new_outlinks, priority, page_id`
    - Integrate with existing `slog` utility

15. ✅ **Metrics**
    - **Counters**: `crawl_started`, `crawl_ok`, `crawl_fail`, `outlinks_enqueued`, `wiki_seen`, `wiki_skipped_after_cap`, `extraction_ok`, `extraction_fail`, `duplicate_content`, `paywall`, `robots_blocked`
    - **Histograms**: `fetch_duration_ms`, `parse_duration_ms`, `text_len`, `outlinks_per_page`
    - **Gauges**: `discovery_queue_depth`, `extraction_queue_depth`, `unique_domains_seen`
    - Use existing `lib/metrics.ts` or extend

16. ✅ **Zero Results Debug Alert**
    - If `extraction_ok` over last 5 minutes == 0 AND `crawl_ok > 0`
    - Log top 5 reason_codes
    - Log last 10 URLs attempted
    - Trigger via existing heartbeat/logging system

### Phase 7: Dashboard & Reporting
**Dependencies**: Phase 6

17. ✅ **Admin Dashboard**
    - Endpoint: `/admin/discovery`
    - HTML page showing:
      - Metrics (counters, histograms, gauges)
      - Sparkline of `extraction_ok` over time
      - Last 50 crawl attempts with reason_code counts
      - Top domains hit
      - % wiki vs non-wiki
      - % short_text (<500 chars)
      - Top fetch failures (DNS, timeout, 403, robots)

18. ✅ **CLI Report Script**
    - Command: `yarn report:zero --since 15m`
    - Prints:
      - Last 50 crawl attempts with reason_code counts
      - Top domains hit
      - % wiki vs non-wiki
      - % short_text (<500 chars)
      - Top fetch failures
    - Create `scripts/report-zero.ts`

### Phase 8: Testing
**Dependencies**: All phases

19. ✅ **Unit Tests**
    - URL normalization
    - Priority scorer
    - Text hash calculation
    - Dedupe logic
    - Article regex matching

20. ✅ **Integration Tests**
    - Run against recorded fixture set (VCR/HTTP cache)
    - Validate queue growth
    - Validate dedupe behavior
    - Test cross-run memory

21. ✅ **E2E Smoke Test**
    - Run topic "Chicago Bulls" for 3 minutes on prod
    - Assert acceptance metrics:
      - ≥60% of processed pages are NON-Wikipedia domains
      - ≥20 unique domains touched
      - ≥10 successful extractions saved with valid JSON
      - At least 1 page includes quotes (≤2 paragraphs) and paraphrase summary

22. ✅ **Cross-Run Dedupe Verification**
    - Re-run immediately after first run
    - Verify already-seen URLs are skipped
    - Observe low duplicate cost
    - Fast progression to new links

### Phase 9: Deployment & Safety
**Dependencies**: All phases

23. ✅ **Feature Flags**
    - `CRAWLER_PRIORITY_V2` (default: ON in prod)
    - `EXTRACTOR_V2` (default: ON in prod)
    - Rollback plan: flags OFF returns to prior behavior
    - Add to existing `lib/discovery/flags.ts`

24. ✅ **Environment Variables**
    - Document in README:
      - `REDIS_URL` (existing)
      - `PG_URL` / `DATABASE_URL` (existing)
      - `LLM_MODEL=deepseek` (new)
      - `LLM_API_KEY` (new)
      - `MAX_PER_DOMAIN=3` (new)
      - `WIKI_CAP=2` (new)
      - `ARTICLE_REGEX` (new, optional)
      - `ZERO_ALERT_WINDOW_MIN=5` (new)

25. ✅ **Documentation**
    - Update README with new env vars
    - Document rollback procedure
    - Document acceptance criteria
    - Add architecture diagram (optional)

---

## Acceptance Criteria

On a 5-minute run for "Chicago Bulls":
- ≥60% of processed pages are NON-Wikipedia domains
- ≥20 unique domains touched
- ≥10 successful extractions saved with valid JSON
- At least 1 page includes quotes (≤2 paragraphs) and a paraphrase summary
- Re-running immediately should SKIP already-seen URLs (observe low duplicate cost and fast progression to new links)
- "Zero Results Debug" prints actionable reasons when extractions==0

---

## Deliverables

1. ✅ PR with code + migration + README updates
2. ✅ Screenshot of `/admin/discovery` showing metrics after a 5-minute "Chicago Bulls" run
3. ✅ Sample NDJSON of 3 extraction records

---

## Rollback Plan

If issues arise:
1. Set `CRAWLER_PRIORITY_V2=false` and `EXTRACTOR_V2=false` in environment
2. System returns to prior behavior (existing discovery engine)
3. New tables (`pages`, `extractions`) remain but are unused
4. Redis keys can be cleaned up if needed

---

## Notes

- All changes are production-safe, incremental commits
- No shadow services - modify existing services in-place
- Keep changes minimal, observable
- Search repo for existing crawler/extractor code and adapt, don't re-invent

