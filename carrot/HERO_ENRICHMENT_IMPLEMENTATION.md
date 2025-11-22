# Hero Enrichment Implementation

## Overview
This document describes the hero enrichment system that creates Hero records for all saved DiscoveredContent, with deep-link fetching, content extraction, quote generation, and image resolution.

## Database Schema

### Hero Model
- `id`: Primary key (cuid)
- `contentId`: Foreign key to DiscoveredContent.id (unique)
- `title`: Extracted title
- `excerpt`: Paraphrased summary (no quotes)
- `quoteHtml`: ≤2 paragraphs, ≤1200 chars
- `quoteCharCount`: Character count of quote
- `imageUrl`: Nullable - hero can exist without image
- `sourceUrl`: Canonical URL that was read
- `status`: DRAFT | READY | ERROR
- `errorCode`: Error classification (PAYWALL, TIMEOUT, HTTP_4XX, etc.)
- `errorMessage`: Error details
- `traceId`: UUID for observability
- `createdAt`, `updatedAt`: Timestamps

## API Endpoints

### POST /api/internal/enrich/[id]
Enriches a single DiscoveredContent item by ID.

**Auth**: `X-Internal-Token` header must match `INTERNAL_ENRICH_TOKEN` env var

**Response**:
```json
{
  "ok": true,
  "heroId": "hero_123",
  "traceId": "uuid",
  "message": "Content enriched successfully"
}
```

### POST /api/internal/backfill-heroes
Backfills heroes for all DiscoveredContent without heroes.

**Auth**: `X-Internal-Token` header must match `INTERNAL_ENRICH_TOKEN` env var

**Body**:
```json
{
  "patchId": "optional_patch_id",
  "limit": 100,
  "concurrency": 5
}
```

**Response**:
```json
{
  "scanned": 50,
  "created": 45,
  "updated": 0,
  "failed": 5
}
```

### GET /api/internal/health/enrichment
Returns enrichment observability data.

**Response**:
```json
{
  "summary": {
    "totalHeroes": 1000,
    "readyHeroes": 950,
    "errorHeroes": 50,
    "draftHeroes": 0,
    "successRate": 95.0
  },
  "errorBreakdown": [
    { "errorCode": "PAYWALL", "count": 30 },
    { "errorCode": "TIMEOUT", "count": 20 }
  ],
  "recentEvents": [...]
}
```

## Enrichment Worker

### Pipeline
1. **Fetch**: Fetch deep link HTML (or use cached `rawHtml`)
   - Timeout: 10s
   - Retries: 2 with backoff
   - User-Agent: `CarrotCrawler/1.0 (+contact@example.com)`

2. **Extract**: Extract content using Mozilla Readability (with DOM fallback)
   - Title, author, publishDate
   - Main text content
   - Paragraphs for quote selection
   - Canonical URL

3. **Quote**: Generate quote (≤2 paragraphs, ≤1200 chars)
   - Selects paragraphs with highest information density
   - Truncates cleanly if needed

4. **Summarize**: Generate paraphrased summary
   - No quotes in summary
   - 100-240 chars
   - Extractive (first 2-3 sentences)

5. **Image**: Attempt to get image (non-blocking)
   - Try OpenGraph `og:image`
   - Try article lead image
   - If fails, continue without image

6. **Upsert**: Create/update Hero record
   - Idempotent (upsert on `contentId`)
   - Status: READY on success, ERROR on failure
   - Always creates record (even on failure) for retry capability

### Error Handling
- **PAYWALL** (401/403): Creates ERROR hero with errorCode='PAYWALL'
- **TIMEOUT**: Creates ERROR hero with errorCode='TIMEOUT'
- **HTTP_4XX/5XX**: Creates ERROR hero with appropriate errorCode
- **PARSE_FAILURE**: Creates ERROR hero with errorCode='PARSE_FAILURE'
- **Image failures**: Never block hero creation (imageUrl=null)

### Observability
Structured JSON logs with:
- `phase`: fetch | extract | summarize | quote | image | upsert
- `traceId`: UUID for correlation
- `ok`: boolean
- `durationMs`: timing
- `errorCode`, `errorMessage`: on failure
- `httpStatus`, `bytes`: for fetch phase

## Frontend Integration

### API Response
The `/api/patches/[handle]/discovered-content` endpoint now:
1. Includes `hero` relation in query
2. Prefers Hero table data over JSON `hero` field
3. Falls back to JSON `hero` field for backward compatibility

### Display
- Hero images render from `hero.url` (from Hero table or JSON)
- If no hero exists, shows gradient placeholder with title
- Status=ERROR heroes can show "Retry enrich" button (future enhancement)

## Migration

Run migration:
```bash
npx prisma migrate deploy
```

Migration file: `prisma/migrations/20250122000000_add_hero_table/migration.sql`

## Testing

### Manual Test
```bash
# Enrich single content
curl -X POST https://<prod>/api/internal/enrich/<CONTENT_ID> \
  -H "X-Internal-Token: <TOKEN>"

# Backfill heroes
curl -X POST https://<prod>/api/internal/backfill-heroes \
  -H "X-Internal-Token: <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "concurrency": 2}'

# Check health
curl https://<prod>/api/internal/health/enrichment
```

### Acceptance Criteria
- ✅ POST /api/internal/enrich/<validContentId> returns 200 and creates/updates hero
- ✅ Backfill processes at least 100 sources and yields created > 0
- ✅ Image service failure doesn't block hero creation (imageUrl=null)
- ✅ Frontend shows newly created heroes
- ✅ Logs show per-phase entries with traceId

## Rollout Plan

1. **Apply Migration**: Run `prisma migrate deploy` on production
2. **Deploy API/Worker**: Deploy updated code
3. **Run Backfill**: `POST /api/internal/backfill-heroes` with `limit=1000, concurrency=5`
4. **Verify**: Check `/api/internal/health/enrichment` and frontend patch pages
5. **Monitor**: Keep verbose logs on for 24h, then reduce to warn/info

## Notes

- Heroes are always created (even on failure) to enable retry
- Image failures never block hero creation
- Backward compatible with existing JSON `hero` field
- Structured logging enables easy debugging
- Idempotent operations prevent duplicates

