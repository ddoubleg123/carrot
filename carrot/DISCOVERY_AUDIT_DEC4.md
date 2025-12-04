# Discovery Audit - December 4, 2025

## Summary
Discovery ran but found **0 items saved**. 249 citations are stuck in `not_scanned` status.

## Key Findings from Render Logs

### 1. Critical Bug: `undefined` Wikipedia Page Title
```
[WikipediaProcessor] Processing Wikipedia page: undefined
[Wikipedia] Error fetching "undefined": TypeError: Cannot read properties of undefined (reading 'replace')
```
**Root Cause**: `getNextWikipediaPageToProcess` is still returning pages with `wikipediaTitle: undefined` despite the fix.

**Impact**: Wikipedia page processing fails, preventing citation extraction from new pages.

### 2. All Citations Getting Rejected
From logs, all processed citations are being denied:
- "ISNI" - HTTP 403 (verification failed)
- "VIAF" - Skipped as low-quality URL
- "GND" - Rejected: Not an actual article (score: 30)
- "WorldCat" - Rejected: Not an actual article (score: 30)
- "France" (BnF) - Rejected: Not an actual article (score: 30)

**Pattern**: All citations are getting AI scores of **30** and being rejected.

**Possible Causes**:
1. Content extraction is failing (getting very short/empty content)
2. AI scoring is consistently returning low scores
3. Validation gates are too strict

### 3. No Citations Saved
- **Processed**: 20 citations
- **Saved**: 0 citations
- **Denied**: 9 citations
- **Errors**: 12 citations

**Diagnostic Output**:
- 249 citations stuck in `not_scanned`
- 0 DiscoveredContent items
- All processed citations have low scores (30) or errors

### 4. Citation Processing Status
- **Total citations**: 8,839 extracted
- **Processed**: 25 (from UI) / 20 (from diagnostic)
- **Saved**: 0
- **Pending**: 267 (from UI) / 249 (from diagnostic)

## Root Causes

### Issue 1: `wikipediaTitle` Still Undefined
The fix to `getNextWikipediaPageToProcess` didn't work or wasn't deployed. Need to verify the actual query.

### Issue 2: Citations Getting Score 30
All citations are getting exactly score 30, which suggests:
- Content extraction is producing very short/empty content
- AI scoring is defaulting to 30 when content is insufficient
- Validation is rejecting before AI scoring

### Issue 3: `saveAsContent` Not Being Called
No logs showing `content_saved` tag, which means `saveAsContent` is either:
- Not being called (citation rejected before reaching save step)
- Returning `null` (save failed)
- Not provided in options

## Next Steps

1. **Fix `wikipediaTitle` undefined issue** - Verify `getNextWikipediaPageToProcess` query
2. **Investigate why all citations get score 30** - Check content extraction and AI scoring
3. **Check why `saveAsContent` isn't saving** - Verify function is provided and working
4. **Process the 249 stuck citations** - Check why they're not being selected

