# Content Enrichment Fixes

## Issues Fixed

### 1. Preview API Cleanup Logic ✅
**Problem**: Cleanup was only running if content was never cleaned before, preventing re-verification of old content.

**Fix**: Updated cleanup condition in `/api/internal/content/[id]/preview/route.ts` to:
- Re-check content cleaned more than 7 days ago
- Always check if content quality is marked as 'poor'
- Respect `forceRecheck` flag
- Better error handling and logging

**Code Change**:
```typescript
// Before: Only cleaned if never cleaned before
const needsCleanup = (preview.summary || preview.keyPoints) && 
                     (!metadata.grammarCleaned || metadata.contentQuality === 'poor')

// After: Re-checks if cleaned more than 7 days ago
const cleanedLongAgo = metadata.grammarCleanedAt ? 
  (Date.now() - new Date(metadata.grammarCleanedAt).getTime() > 7 * 24 * 60 * 60 * 1000) : false

const needsCleanup = hasContent && (neverCleaned || isPoorQuality || needsRecheck || cleanedLongAgo)
```

### 2. Server-Side Enrichment API ✅
**Problem**: No way to trigger bulk enrichment on the server where DeepSeek API key is available.

**Fix**: Created `/api/dev/enrich-israel-content` endpoint that:
- Runs on server with DeepSeek API key
- Processes all Israel patch content in batches
- Cleans grammar and improves summaries/key facts
- Skips recently cleaned items (within 24 hours)
- Returns detailed results

**Usage**:
```bash
curl -X POST https://carrot-app.onrender.com/api/dev/enrich-israel-content \
  -H "x-internal-key: YOUR_INTERNAL_API_KEY"
```

## How to Use

### Option 1: Automatic (Preview API)
When users view content, the preview API will automatically:
- Check if content needs cleanup
- Run DeepSeek grammar cleanup if needed
- Persist cleaned content to database
- Re-check content cleaned more than 7 days ago

### Option 2: Manual (Enrichment API)
Call the enrichment API to bulk-process all content:

```bash
# From server or with API key
curl -X POST https://carrot-app.onrender.com/api/dev/enrich-israel-content \
  -H "x-internal-key: ${INTERNAL_API_KEY}"
```

Or use the test script:
```bash
cd carrot
INTERNAL_API_KEY=your_key npx tsx scripts/test-enrichment-api.ts
```

## Current Status

- ✅ Hero Images: 96.1% have real images (49/51)
- ✅ Hero Count: 100% coverage (51/51)
- ⚠️ Content Quality: 0% grammar cleaned (needs API call)
- ⚠️ Quotes: 0% have quotes (needs enrichment)

## Next Steps

1. **Run enrichment API** on server to process all content
2. **Monitor preview API logs** to see cleanup running automatically
3. **Verify frontend** shows improved content after enrichment

## Files Changed

- `carrot/src/app/api/internal/content/[id]/preview/route.ts` - Fixed cleanup logic
- `carrot/src/app/api/dev/enrich-israel-content/route.ts` - New enrichment endpoint
- `carrot/scripts/test-enrichment-api.ts` - Test script for API

