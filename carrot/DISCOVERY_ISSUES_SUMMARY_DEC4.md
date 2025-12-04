# Discovery Issues Summary - December 4, 2025

## Critical Issues Found

### 1. ✅ FIXED: `undefined` Wikipedia Page Title
**Problem**: `[WikipediaProcessor] Processing Wikipedia page: undefined`
- `getNextWikipediaPageToProcess` was returning pages with `wikipediaTitle: undefined`
- This caused `WikipediaSource.getPage` to fail with `TypeError: Cannot read properties of undefined (reading 'replace')`

**Fix Applied**: 
- Added fallback logic to extract title from URL if `wikipediaTitle` is null/undefined
- Ensures `title` is never undefined in the returned page object

### 2. ⚠️ IN PROGRESS: All Citations Getting Score 30
**Problem**: All processed citations are getting AI score of 30 and being rejected
- "GND" - score: 30, rejected
- "WorldCat" - score: 30, rejected
- "France" (BnF) - score: 30, rejected

**Possible Causes**:
1. Content extraction is producing very short/empty content
2. AI scoring is defaulting to 30 when content is insufficient
3. Citations being processed are mostly metadata/catalog pages (correctly rejected)

**Next Steps**: Need to check why legitimate external URLs aren't being processed

### 3. ⚠️ IN PROGRESS: 249 Citations Stuck in `not_scanned`
**Problem**: 249 citations with `scanStatus: 'not_scanned'` are not being selected for processing

**Possible Causes**:
1. `getNextCitationToProcess` query is too restrictive
2. Citations have `verificationStatus: 'pending_wiki'` (Wikipedia internal links)
3. Citations are being filtered out by URL pattern matching

**Next Steps**: Check the actual query and verify which citations are being selected

### 4. ⚠️ IN PROGRESS: No Citations Saved
**Problem**: 0 DiscoveredContent items saved despite 20 citations processed

**Root Cause**: Citations are being rejected before reaching `saveAsContent` because:
- AI scores are all 30 (below threshold of 60)
- `finalIsRelevant` requires `aiPriorityScore >= 60` AND `isRelevant: true`
- `saveAsContent` is only called if `finalIsRelevant && options.saveAsContent`

**Next Steps**: 
- Verify `saveAsContent` function is being called
- Check why citations are getting low scores
- Process the 249 stuck citations to see if they have better scores

## Statistics from Diagnostic

- **Total citations extracted**: 8,839
- **Citations processed**: 20
- **Citations saved**: 0
- **Citations stuck**: 249
- **Wikipedia pages**: 25
- **Pages scanned**: 25

## Next Actions

1. ✅ Fix `undefined` Wikipedia page title (DONE)
2. Check why 249 citations aren't being selected
3. Investigate why all citations get score 30
4. Verify `saveAsContent` is being called for relevant citations
5. Process stuck citations to see if they have better content/scores

