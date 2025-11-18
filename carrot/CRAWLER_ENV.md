# Crawler Environment Variables

## Required

- `REDIS_URL` - Redis connection URL (existing, required for queues)
- `DATABASE_URL` - PostgreSQL connection URL (existing, required for pages/extractions tables)
- `LLM_API_KEY` - API key for LLM provider (DeepSeek or equivalent)

## Optional (with defaults)

- `LLM_MODEL` - LLM model identifier (default: `deepseek`)
- `MAX_PER_DOMAIN` - Max concurrent fetches per domain (default: `3`)
- `WIKI_CAP` - Max Wikipedia pages per run before downranking (default: `2`)
- `ARTICLE_REGEX` - Custom regex for article-like URL detection (default: `/\d{4}\/\d{2}\/|\/\d{4}\/|\/news\/|\/article\/|\/story\/|\/sports\//`)
- `ZERO_ALERT_WINDOW_MIN` - Minutes window for zero results alert (default: `5`)
- `FETCH_TIMEOUT_MS` - HTTP fetch timeout in milliseconds (default: `15000`)
- `CRAWLER_USER_AGENT` - User agent string for fetches (default: `Mozilla/5.0 (compatible; CarrotCrawler/1.0)`)
- `CRAWLER_MAX_RETRIES` - Max retry attempts for failed fetches (default: `3`)
- `CRAWLER_BASE_BACKOFF_MS` - Base backoff delay in milliseconds (default: `1000`)
- `DISCOVERY_CONCURRENCY` - Concurrent discovery workers (default: `3`)
- `EXTRACTION_CONCURRENCY` - Concurrent extraction workers (default: `2`)

## New Environment Variables (Deep-Link Crawler)

- `CRAWL_RENDER_ENABLED` - Enable Playwright renderer for JS sites (default: `false`, set to `true` to enable)
- `CRAWL_RENDER_TIMEOUT_MS` - Playwright navigation timeout in milliseconds (default: `16000`)
- `CRAWL_MIN_SEEDS_PER_CYCLE` - Minimum seeds to emit per query expansion cycle (default: `10`)
- `CRAWL_WIKI_OUTLINK_LIMIT` - Max outlinks to extract from Wikipedia pages (default: `25`)
- `CRAWL_SEEN_TTL_DAYS` - TTL for seen URLs cache in days (default: `7`)
- `CRAWL_RETRY_SOFTFAIL` - Allow retry for soft failures (timeout, extractor_empty) (default: `true`)
- `CRAWLER_MAX_RESEED_ATTEMPTS` - Max reseed attempts before circuit breaker (default: `10`, raised from 3)

## Feature Flags

- `CRAWLER_PRIORITY_V2` - Enable new priority scoring system (default: `true`)
- `EXTRACTOR_V2` - Enable new LLM extractor (default: `true`)

To disable features, set to `false`:
```bash
CRAWLER_PRIORITY_V2=false
EXTRACTOR_V2=false
```

## Example Production Configuration

```bash
REDIS_URL=rediss://...
DATABASE_URL=postgresql://...
LLM_API_KEY=sk-...
LLM_MODEL=deepseek
MAX_PER_DOMAIN=3
WIKI_CAP=2
FETCH_TIMEOUT_MS=15000
CRAWLER_PRIORITY_V2=true
EXTRACTOR_V2=true
```

