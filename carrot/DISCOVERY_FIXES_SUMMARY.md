# Discovery Process Fixes Summary

## Issues Found

### 1. ✅ FIXED: Citations Not Being Processed
**Problem**: 8,678 citations have `verificationStatus: 'failed'` and were being filtered out
**Fix**: Updated `getNextCitationToProcess` to include `'failed'` status in the query
**File**: `carrot/src/lib/discovery/wikipediaCitation.ts`

### 2. ✅ COMPLETED: Script to Show Next URLs
**Created**: `carrot/scripts/show-next-external-urls.ts`
- Shows next 10 external URLs to process
- Includes Wikipedia source page and reference number
- Shows priority scores and status

### 3. 🔄 IN PROGRESS: Fix Seed Generation
**Problem**: Only 1 seed candidate for Israel patch
**Needed**: Regenerate guide with 10+ seeds

### 4. ⏳ PENDING: Wikipedia Priority Levels
**Problem**: No tracking of Wikipedia page levels (Level 1 = seeds, Level 2 = linked from Level 1, etc.)
**Needed**: 
- Add `wikipediaLevel` field to track priority
- Process by level: Level 1 → Level 2 → Level 3

### 5. ⏳ PENDING: Wikipedia-to-Wikipedia Crawling
**Problem**: System doesn't extract internal Wikipedia links to crawl more pages
**Needed**:
- Extract internal Wikipedia links from each processed page
- Enqueue them with appropriate priority level
- Process them to extract their citations

### 6. ✅ ALREADY EXISTS: Reference Number Tracking
**Status**: `sourceNumber` is already stored in `wikipediaCitation` table
**Note**: Reference numbers are tracked, just need to ensure they're displayed in queries

## Next Steps

1. **Fix seed generation** - Regenerate guide for Israel patch
2. **Add Wikipedia priority levels** - Implement level tracking and processing
3. **Add Wikipedia-to-Wikipedia crawling** - Extract and process internal links
4. **Debug why nothing is saved** - Check relevance/acceptance criteria (persisted:0 issue)

