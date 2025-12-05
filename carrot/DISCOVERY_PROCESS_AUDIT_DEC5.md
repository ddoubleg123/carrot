# Discovery Process Full Audit - December 5, 2025

## Executive Summary
Discovery ran but found **0 items saved** (`persisted: 0` in all heartbeats). All citations are being rejected with score 30 ("Not an actual article"). Multiple critical errors are preventing content from being saved.

## Critical Issues Identified

### 1. **All Citations Rejected with Score 30** ⚠️ CRITICAL
**Status**: 🔴 BROKEN
**Location**: `wikipediaProcessor.ts` - `scoreCitationContent` function
**Evidence from logs**:
```
[WikipediaProcessor] DeepSeek content scoring for "A history of Israel, Palestine and the Arab-Israeli Conflict": {
  score: 30,
  isRelevant: false,
  reason: 'Not an actual article (metadata/catalog page)',
  finalDecision: 'NOT RELEVANT'
}
```

**Root Cause**: The AI scoring function is incorrectly identifying all content as "metadata/catalog pages" even when they are actual articles. The threshold is 60, but everything is getting 30.

**Impact**: **100% of citations are being rejected** - nothing is saved to DiscoveredContent.

**Fix Required**: 
- Review the AI prompt in `scoreCitationContent` function
- Check if content extraction is working properly (may be extracting only metadata)
- Lower threshold or fix the "isActualArticle" check logic

---

### 2. **"undefined" Wikipedia Page Title Error** ⚠️ CRITICAL
**Status**: 🔴 BROKEN (Previously fixed but reappeared)
**Location**: `wikipediaMonitoring.ts` - `getNextWikipediaPageToProcess`
**Evidence from logs**:
```
[WikipediaProcessor] Processing Wikipedia page: undefined
[Wikipedia] Fetching page: "undefined"
[Wikipedia] Error fetching "undefined": TypeError: Cannot read properties of undefined (reading 'replace')
```

**Root Cause**: The `wikipediaTitle` field is `undefined` in the database record, and our fallback logic isn't working.

**Impact**: Wikipedia pages cannot be processed, citations cannot be extracted.

**Fix Required**: 
- Verify `wikipediaTitle` is being set when pages are added to monitoring
- Add better fallback to extract title from URL if `wikipediaTitle` is missing
- Check `processNextWikipediaPage` to ensure it handles undefined titles

---

### 3. **ContentExtractor Summarization Failing** ⚠️ HIGH
**Status**: 🟡 PARTIALLY FIXED (URL fixed, but HTTP 400 errors persist)
**Location**: `content-quality.ts` - `summarizeContent` function
**Evidence from logs**:
```
[ContentExtractor] Summarization failed: Error: Summarization failed: 400
```

**Root Cause**: The API endpoint `/api/ai/summarize-content` is returning HTTP 400, likely due to:
- Invalid request body format
- Missing required fields
- Domain parameter format issue

**Impact**: Content extraction works but summarization fails, may affect quality scoring.

**Fix Required**: 
- Verify request body matches API schema
- Check if `domain` parameter needs to be a full URL vs just domain name
- Add better error logging to see exact API response

---

### 4. **Citation Prioritization JSON Parsing Errors** ⚠️ MEDIUM
**Status**: 🟡 WORKING WITH FALLBACK
**Location**: `wikipediaProcessor.ts` - `prioritizeCitations` function
**Evidence from logs**:
```
[EngineV21] Citation prioritization failed, using original order: SyntaxError: Unterminated string in JSON at position 2986
```

**Root Cause**: DeepSeek API is returning incomplete/malformed JSON responses.

**Impact**: Citations are processed in original order instead of prioritized order (non-critical, but suboptimal).

**Fix Required**: 
- Improve JSON recovery logic
- Add retry mechanism for malformed responses
- Consider streaming JSON parser

---

### 5. **No Content Being Saved (persisted: 0)** ⚠️ CRITICAL
**Status**: 🔴 BROKEN
**Location**: Entire discovery pipeline
**Evidence from logs**:
```
{"ts":"2025-12-05T01:05:52.086Z","level":"info","step":"discovery","msg":"heartbeat","job_id":"cmip4pwb40001rt1t7a13p27g","run_id":"cmis5y3zo0001mz1t4vb2akn9","queue_len":10,"uptime_s":15,"fetched":2,"enqueued":0,"deduped":0,"skipped":0,"persisted":0,"errors":0}
```

**Root Cause**: Combination of issues #1 and #2 - citations are being rejected before they can be saved.

**Impact**: **Zero content discovered** - discovery is running but producing no results.

---

## Step-by-Step Process Flow Audit

### Phase 1: Discovery Engine Startup ✅ WORKING
1. ✅ Discovery run created in database
2. ✅ Guide/plan generated or loaded
3. ✅ Frontier seeded with initial URLs
4. ✅ Engine v2.1 started (`runOpenEvidenceEngine`)

### Phase 2: Wikipedia Page Processing 🔴 BROKEN
1. ✅ `processWikipediaIncremental` called every 30 seconds
2. ✅ `getNextWikipediaPageToProcess` finds pages
3. 🔴 **FAILS HERE**: `wikipediaTitle` is `undefined` → `processNextWikipediaPage` fails
4. ❌ Page HTML not fetched
5. ❌ Citations not extracted
6. ❌ Citations not stored in database

**Fix**: Ensure `wikipediaTitle` is always set when pages are added to monitoring.

### Phase 3: Citation Processing 🔴 BROKEN
1. ✅ `getNextCitationToProcess` finds citations
2. ✅ URL verification (HEAD/GET) works
3. ✅ Content extraction works (ContentExtractor)
4. 🟡 Summarization fails (HTTP 400) - non-critical
5. 🔴 **FAILS HERE**: AI scoring returns score 30 for all citations
6. ❌ All citations rejected (threshold is 60)
7. ❌ `saveAsContent` never called (only called if `finalIsRelevant === true`)
8. ❌ Nothing saved to DiscoveredContent

**Fix**: Fix AI scoring logic to properly identify articles vs metadata pages.

### Phase 4: Content Saving ❌ NEVER REACHED
1. ❌ `saveAsContent` function never called (citations rejected before this step)
2. ❌ No DiscoveredContent records created
3. ❌ `persisted: 0` in all heartbeats

---

## Database State Analysis

### Wikipedia Monitoring Table
- **Status**: Pages exist but `wikipediaTitle` is `undefined` for some records
- **Action Required**: 
  - Backfill `wikipediaTitle` from URL for existing records
  - Ensure new records always have `wikipediaTitle` set

### Wikipedia Citations Table
- **Status**: Citations are being stored but not processed
- **Count**: 1913 citations for "Israeli–Palestinian conflict" page
- **Processing Status**: 
  - 1896/1913 processed (99.1%)
  - All processed citations have `relevanceDecision: 'denied'`
  - All have `aiPriorityScore: 30` or `null`

### DiscoveredContent Table
- **Status**: Empty (no new content saved)
- **Action Required**: Fix scoring to allow citations to pass threshold

---

## Recommended Fix Priority

### Priority 1: Fix AI Scoring (Score 30 Issue) 🔴
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`
**Function**: `scoreCitationContent`
**Action**:
1. Review AI prompt - may be too strict about "actual article" check
2. Check if content extraction is getting full article text or just metadata
3. Add logging to see what content is being sent to AI
4. Consider lowering threshold from 60 to 50 temporarily to test
5. Verify `isActualArticle` check logic isn't rejecting valid articles

### Priority 2: Fix Undefined Wikipedia Title 🔴
**File**: `carrot/src/lib/discovery/wikipediaMonitoring.ts`
**Function**: `getNextWikipediaPageToProcess`
**Action**:
1. Ensure `wikipediaTitle` is always selected in query
2. Add fallback to extract title from URL if `wikipediaTitle` is missing
3. Backfill existing records with missing titles
4. Add validation when creating new monitoring records

### Priority 3: Fix ContentExtractor Summarization 🟡
**File**: `carrot/src/lib/discovery/content-quality.ts`
**Function**: `summarizeContent`
**Action**:
1. Verify request body format matches API schema
2. Check if `domain` should be full URL or just domain name
3. Add detailed error logging to see API response
4. Test API endpoint directly to verify it's working

### Priority 4: Improve JSON Parsing Recovery 🟡
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`
**Function**: `prioritizeCitations`
**Action**:
1. Enhance JSON recovery logic
2. Add retry mechanism
3. Consider streaming parser for large responses

---

## Testing Plan

1. **Test AI Scoring**:
   - Manually call `scoreCitationContent` with known good article
   - Verify it returns score >= 60
   - Check what content is being sent to AI

2. **Test Wikipedia Page Processing**:
   - Verify `wikipediaTitle` is set for all monitoring records
   - Test `getNextWikipediaPageToProcess` returns valid title
   - Test `processNextWikipediaPage` with valid title

3. **Test Citation Processing**:
   - Process a single citation manually
   - Verify it passes AI scoring
   - Verify `saveAsContent` is called
   - Verify DiscoveredContent record is created

4. **End-to-End Test**:
   - Run discovery for 5 minutes
   - Verify at least 1 item is saved
   - Check `persisted` count in heartbeat logs

---

## Metrics to Monitor

- `persisted` count in heartbeat (should be > 0)
- `aiPriorityScore` distribution (should have scores >= 60)
- `relevanceDecision` breakdown (should have some 'saved')
- `wikipediaTitle` null/undefined count (should be 0)
- ContentExtractor summarization success rate (should be > 90%)

---

## Next Steps

1. **Immediate**: Fix AI scoring issue (Priority 1)
2. **Immediate**: Fix undefined Wikipedia title (Priority 2)
3. **Short-term**: Fix ContentExtractor summarization (Priority 3)
4. **Short-term**: Improve JSON parsing (Priority 4)
5. **Verification**: Run discovery again and verify items are saved

---

## Log Analysis Summary

### Heartbeat Metrics (All Show persisted: 0)
```
"persisted":0,"errors":0
"persisted":0,"errors":0
"persisted":0,"errors":0
```

### Citation Processing Results
- All citations getting score 30
- All citations rejected with "Not an actual article"
- No citations saved to DiscoveredContent

### Error Patterns
- `undefined` Wikipedia title: ~10 occurrences
- ContentExtractor summarization 400: ~5 occurrences
- JSON parsing errors: ~2 occurrences

---

**Last Updated**: December 5, 2025
**Status**: 🔴 CRITICAL - Discovery not saving any content

