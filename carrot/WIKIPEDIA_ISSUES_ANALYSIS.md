# Wikipedia Citation Processing Issues - Analysis & Plan

## Issues Identified from Frontend

1. **Irrelevant Articles Being Saved**: Articles like "May", "Adolph Rupp Trophy", "Flagg", "Tshiebwe" don't seem relevant to Chicago Bulls
2. **No Hero Images**: No Wikimedia/AI images showing for saved articles
3. **No Hero URL**: Clicking on hero shows no specific URL
4. **No Content Saved**: Saved articles have no actual content/text

## Root Cause Analysis

### Issue 1: Irrelevant Articles Being Saved

**Current Logic Flow:**
- `wikipediaProcessor.ts` line 519: Citations are only saved if `isRelevant === true`
- Relevance check (lines 490-496):
  - Requires: `(aiPriorityScore >= 60 OR highRelevanceEngineScore) AND relevanceEngine.isRelevant AND contentLength > 500`
  - BUT: Diagnostic showed citations with `aiPriorityScore: 50` (default)
  - This means citations are passing relevance check even with low AI scores

**Problem:**
- The relevance check is too lenient OR
- Citations are being saved through a different code path OR
- The AI priority scoring is defaulting to 50 and RelevanceEngine is approving everything

**Evidence:**
- Frontend shows articles that don't seem relevant
- Diagnostic showed 2,785 citations with `pending + not_scanned + no decision`
- All have AI Priority: 50 (default score)

### Issue 2: No Hero Images

**Current Logic:**
- `engineV21.ts` line 622: Hero is set to `Prisma.JsonNull` initially
- `wikipediaProcessor.ts` line 535: Fetch call to `/api/internal/enrich/${savedContentId}`
- Base URL construction (line 534): `process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL ? https://${VERCEL_URL} : http://localhost:3000`

**Problems:**
1. **Base URL might be wrong**: `VERCEL_URL` might not be set in production (Render)
2. **Auth token might be missing**: Requires `X-Internal-Token` header matching `INTERNAL_ENRICH_TOKEN`
3. **Fetch is fire-and-forget**: Errors are silently caught (line 541-544)
4. **No hero record created initially**: Hero table record is only created by enrich API, not during save

**Evidence:**
- Frontend shows no hero images
- No hero URLs in the data

### Issue 3: No Content Saved

**Current Logic:**
- `wikipediaProcessor.ts` lines 458-464: Very basic HTML stripping
- `engineV21.ts` line 624: `textContent: cleanedText` is set
- `engineV21.ts` line 625: `content: cleanedText` is set

**Problems:**
1. **Content extraction is too basic**: Just strips HTML tags, might result in empty/minimal content
2. **No content validation**: Doesn't check if extracted content is meaningful
3. **Frontend might be filtering**: API might be filtering out items without sufficient content

**Evidence:**
- Frontend shows articles with no content
- Diagnostic showed citations being processed but content might be empty

### Issue 4: Hero URL Missing

**Current Logic:**
- Hero is `Prisma.JsonNull` initially
- Hero record should be created by enrich API
- Frontend reads from `heroRecord` relation (preferred) or `hero` JSON field

**Problems:**
1. Enrich API might not be called (base URL issue)
2. Enrich API might be failing (auth token issue)
3. Hero record might not be created even if enrich succeeds

## What's Working ✅

1. **Citation Extraction**: 7,874 citations extracted from 20 pages
2. **Citation Processing**: 3,255 citations processed (41% progress)
3. **Database Storage**: Citations are being saved to `DiscoveredContent` table
4. **Status Tracking**: Citation statuses are being tracked correctly
5. **API Endpoints**: Discovered content API is returning data

## What's NOT Working ❌

1. **Relevance Filtering**: Irrelevant citations are being saved
2. **Hero Image Generation**: No hero images are being generated
3. **Content Extraction**: Content is empty or minimal
4. **Hero Record Creation**: No hero records in Hero table
5. **Enrich API Calls**: Enrich API might not be called or failing silently

## Recommended Fix Plan

### Phase 1: Fix Relevance Filtering
1. **Tighten relevance criteria**: Increase AI score threshold or require both AI score AND RelevanceEngine approval
2. **Fix AI priority scoring**: Ensure citations get proper priority scores (not defaulting to 50)
3. **Add logging**: Log why citations pass/fail relevance checks
4. **Review saved articles**: Check why "May", "Adolph Rupp Trophy", etc. passed relevance

### Phase 2: Fix Hero Image Generation
1. **Fix base URL**: Use correct base URL for Render environment
2. **Fix auth token**: Ensure `INTERNAL_ENRICH_TOKEN` is set and matches
3. **Add error handling**: Log enrich API failures instead of silently catching
4. **Create hero record on save**: Create Hero record with DRAFT status during save, then enrich later
5. **Add retry mechanism**: Retry hero generation if initial attempt fails

### Phase 3: Fix Content Extraction
1. **Improve HTML parsing**: Use better HTML extraction (e.g., Readability, cheerio)
2. **Add content validation**: Ensure extracted content has minimum length/quality
3. **Add fallback extraction**: If basic extraction fails, try alternative methods
4. **Log extraction results**: Log content length and quality metrics

### Phase 4: Fix Hero URL Display
1. **Ensure hero record creation**: Create hero record during save (even if DRAFT)
2. **Link hero record properly**: Ensure `heroRecord` relation is properly linked
3. **Update frontend mapping**: Ensure frontend correctly reads from `heroRecord.imageUrl`

## Files to Review/Modify

1. `carrot/src/lib/discovery/wikipediaProcessor.ts` - Relevance logic, content extraction, hero trigger
2. `carrot/src/lib/discovery/engineV21.ts` - Save logic, hero initialization
3. `carrot/src/app/api/internal/enrich/[id]/route.ts` - Enrich API endpoint
4. `carrot/src/lib/enrichment/worker.ts` - Hero generation worker
5. `carrot/src/app/api/patches/[handle]/discovered-content/route.ts` - API response mapping

## Diagnostic Queries Needed

1. Check actual saved articles and their relevance scores
2. Check if enrich API is being called (server logs)
3. Check hero table for records linked to saved citations
4. Check content length of saved articles
5. Check why specific articles passed relevance checks

