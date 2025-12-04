# Discovery Fixes Applied - December 4, 2025

## Issues Fixed

### 1. ✅ Fixed: `undefined` Wikipedia Page Title
**Problem**: `getNextWikipediaPageToProcess` was returning pages with `wikipediaTitle: undefined`
**Fix**: Added fallback logic to extract title from URL if `wikipediaTitle` is null/undefined
**Status**: Fixed and deployed

### 2. ✅ Fixed: Citation Selection Query
**Problem**: Citations with `aiPriorityScore: null` might not be selected properly due to ordering
**Fix**: 
- Updated `orderBy` to use `nulls: 'last'` to ensure citations without scores are still processed
- Added `scanning` to `scanStatus` filter to handle cases where a process crashed mid-scan
**Status**: Fixed

### 3. ⚠️ Understanding: Score 30 Issue
**Root Cause**: Citations getting score 30 are metadata/catalog pages (VIAF, GND, WorldCat, BnF)
**Explanation**: 
- These are correctly being rejected by `scoreCitationContent` when `isActuallyAnArticle` returns false
- The function returns score 30 for non-articles (line 252 in wikipediaProcessor.ts)
- This is expected behavior - these pages should not be saved as content

**Next Steps**: 
- The 249 stuck citations are likely legitimate external URLs that should be processed
- They should get better scores once processed
- The query fix should allow them to be selected

### 4. ⚠️ Understanding: No Citations Saved
**Root Cause**: Citations need score >= 60 AND `isRelevant: true` to be saved
**Current State**: 
- All processed citations are metadata pages getting score 30
- These are correctly rejected
- Once legitimate external URLs are processed, they should get higher scores and be saved

**Next Steps**: 
- Process the 249 stuck citations (likely legitimate external URLs)
- They should get better scores and be saved if relevant

## Changes Made

1. **wikipediaMonitoring.ts**:
   - Added fallback to extract title from URL if `wikipediaTitle` is null
   - Ensures `title` is never undefined

2. **wikipediaCitation.ts**:
   - Updated `orderBy` to handle null `aiPriorityScore` values
   - Added `scanning` to `scanStatus` filter to handle crashed processes
   - Improved diagnostic logging

## Expected Results

After these fixes:
1. Wikipedia pages should process without `undefined` errors
2. Citations with null priority scores should be selected
3. Legitimate external URLs should be processed and scored
4. Citations with score >= 60 should be saved to DiscoveredContent

## Testing

Run discovery again and check:
- No `undefined` Wikipedia page errors
- 249 stuck citations start being processed
- Citations get scores > 30 (for legitimate articles)
- Some citations are saved to DiscoveredContent

