# Discovery Fixes Summary - December 4, 2025

## Issues Fixed

### ✅ Fix 1: Wikipedia Internal Link Filtering
**Problem**: Wikipedia internal links (relative paths like `./Languages_of_Israel`) were being stored in the citations table
**Solution**: 
- Added explicit filtering in `extractAndStoreCitations` to filter out Wikipedia URLs before storage
- Updated `getNextCitationToProcess` query to exclude Wikipedia internal links using `NOT` conditions

**Files Modified**:
- `carrot/src/lib/discovery/wikipediaCitation.ts` - Added filtering in `extractAndStoreCitations` and `getNextCitationToProcess`

### ✅ Fix 2: Undefined Wikipedia Page Title
**Problem**: `[WikipediaProcessor] Processing Wikipedia page: undefined` error
**Solution**: 
- Updated `getNextWikipediaPageToProcess` to explicitly select `wikipediaTitle` field
- Convert result to expected format with `title` field

**Files Modified**:
- `carrot/src/lib/discovery/wikipediaMonitoring.ts` - Added `select` clause and format conversion

### ✅ Fix 3: Citation Prioritization JSON Parsing
**Problem**: `SyntaxError: Unterminated string in JSON at position 2974` when prioritizing citations
**Solution**: 
- Added multiple recovery strategies for malformed JSON:
  1. Extract valid JSON objects from partial response
  2. Truncate at error position and extract last complete JSON
  3. Extract valid JSON array from response
- Falls back to default scores if all recovery attempts fail

**Files Modified**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts` - Enhanced `prioritizeCitations` error handling

### ✅ Fix 4: getNextCitationToProcess Query
**Problem**: Query was selecting Wikipedia internal links instead of external URLs
**Solution**: 
- Added `NOT` conditions to exclude:
  - URLs starting with `./`
  - URLs starting with `/wiki/`
  - URLs containing `wikipedia.org`
  - URLs containing `wikimedia.org`
  - URLs containing `wikidata.org`

**Files Modified**:
- `carrot/src/lib/discovery/wikipediaCitation.ts` - Updated `getNextCitationToProcess` query

### ✅ Fix 5: Cleanup Existing Wikipedia Internal Links
**Problem**: 8,541 Wikipedia internal links were already stored in the database, blocking processing
**Solution**: 
- Created cleanup script to mark all Wikipedia internal links as `scanned_denied` with `relevanceDecision: denied_verify`
- Ran cleanup: marked 8,541 citations as denied

**Files Created**:
- `carrot/scripts/cleanup-wikipedia-internal-links.ts`

## Results

### Before Fixes
- **8,683 citations** stuck in `pending / not_scanned`
- **0 citations saved**
- System processing Wikipedia internal links instead of external URLs
- Wikipedia page title undefined errors
- Citation prioritization failing with JSON errors

### After Fixes
- **284 citations** ready to process (down from 8,683)
- **8,541 Wikipedia internal links** marked as denied
- System now filters Wikipedia links at extraction and query level
- Wikipedia page title correctly retrieved
- Citation prioritization has robust error recovery

## Next Steps

1. ✅ All fixes implemented
2. ⏳ Test discovery run to verify external URLs are being processed
3. ⏳ Monitor live tracker to see citations being saved
4. ⏳ Verify that the 284 remaining citations are external URLs

## Files Modified

1. `carrot/src/lib/discovery/wikipediaCitation.ts` - Filtering and query fixes
2. `carrot/src/lib/discovery/wikipediaMonitoring.ts` - Title fix
3. `carrot/src/lib/discovery/wikipediaProcessor.ts` - JSON parsing fix
4. `carrot/scripts/cleanup-wikipedia-internal-links.ts` - Cleanup script (new)
5. `carrot/scripts/diagnose-discovery-issues.ts` - Diagnosis script (new)

