# Discovery Process Audit - Step-by-Step Analysis

## Executive Summary

**Status**: Discovery runs successfully but saves **0 items** despite processing 50 citations per run.

**Key Finding**: Citations are being processed but failing at multiple stages:
- HTTP 403 errors blocking verification
- Content extraction may be producing insufficient content
- AI scoring may be rejecting all content (no logs showing scores)
- No evidence of content being saved to DiscoveredContent

---

## Step-by-Step Process Audit

### Phase 1: Discovery Initialization ✅ WORKING

**What Happens:**
1. Discovery run starts (`run_start` event)
2. DiscoveryEngineV21 initializes
3. Wikipedia pages are fetched and citations extracted

**Evidence from Logs:**
- ✅ `run_start` event logged successfully
- ✅ Wikipedia page fetched: `https://en.wikipedia.org/wiki/Israel`
- ✅ 24 Wikipedia outlinks enqueued
- ✅ `processWikipediaIncremental` called

**Status**: ✅ **WORKING**

---

### Phase 2: Wikipedia Page Processing ✅ WORKING

**What Happens:**
1. Wikipedia pages are added to `wikipediaMonitoring` table
2. Pages are scanned for content
3. Citations are extracted and stored in `wikipediaCitation` table

**Evidence from Logs:**
- ✅ 25 pages in monitoring table
- ✅ All 25 pages have `contentScanned: true` and `citationsExtracted: true`
- ✅ 8,827 citations extracted (from UI: "CITATIONS EXT..." = 8,827)
- ✅ 151 citations processed (from UI: "CITATIONS PRO..." = 151)

**Status**: ✅ **WORKING**

**Note**: All pages are marked as `completed`, meaning they've been fully processed.

---

### Phase 3: Citation Selection for Processing ⚠️ PARTIALLY WORKING

**What Happens:**
1. `getNextCitationToProcess` queries for citations to process
2. Selects citations with:
   - `verificationStatus: { in: ['pending', 'verified', 'failed'] }`
   - `scanStatus: { in: ['not_scanned', 'scanning'] }`
   - `relevanceDecision: null`

**Evidence from Logs:**
- ✅ Citations are being selected: `[WikipediaCitation] Found citation to process: "Official website"`
- ⚠️ **ISSUE**: Same citation (`https://www.gov.il/en/departments/prime_ministers_office/govil-landing-page`) is being selected repeatedly
- ⚠️ **ISSUE**: Citation keeps failing verification (HTTP 403) but is being re-selected

**Status**: ⚠️ **PARTIALLY WORKING** - Citations are selected, but there's a loop issue with failed citations

**Root Cause**: Citations with `verificationStatus: 'failed'` are still eligible for processing if `scanStatus: 'not_scanned'`. When they fail verification, they're marked as `failed` but `scanStatus` may not be updated, causing them to be re-selected.

---

### Phase 4: URL Verification ❌ FAILING (CRITICAL BLOCKER)

**What Happens:**
1. Citation URL is verified with HEAD request
2. If verification fails, citation is marked as `verificationStatus: 'failed'`
3. **CRITICAL**: Function returns early (line 854) if verification fails, preventing content extraction

**Evidence from Logs:**
- ❌ **REPEATED FAILURES**: `[WikipediaProcessor] Citation "Official website" verification failed: HTTP 403`
- ❌ Same URL failing repeatedly: `https://www.gov.il/en/departments/prime_ministers_office/govil-landing-page`
- ❌ No successful verifications logged
- ❌ **NO CONTENT EXTRACTION LOGS**: Because function returns early on verification failure

**Status**: ❌ **FAILING - CRITICAL BLOCKER**

**Root Causes:**
1. **HTTP 403 Forbidden**: Website is blocking automated requests
2. **Missing User-Agent**: Verification uses HEAD request without proper headers
3. **No Retry Logic**: Failed URLs are immediately marked as failed without retry
4. **Infinite Loop**: Failed citations are being re-selected because `scanStatus` isn't updated
5. **Early Return**: When verification fails, function returns at line 854, skipping all content extraction, validation, AI scoring, and saving

**Impact**: 
- **CRITICAL**: Citations failing verification never reach content extraction
- This explains why we see NO `content_extract` logs
- This explains why we see NO AI scoring logs
- This explains why nothing is being saved
- **This is the primary blocker preventing any content from being saved**

---

### Phase 5: Content Extraction ❌ NEVER INVOKED (BLOCKED BY VERIFICATION)

**What Happens:**
1. If verification succeeds, content is fetched
2. 3-stage extraction chain: Readability → ContentExtractor → fallback
3. Content is normalized and validated
4. **Structured logging exists** (line 936-943) but is **NEVER INVOKED**

**Evidence from Logs:**
- ❌ **NO LOGS**: No `content_extract` events logged
- ❌ **NO LOGS**: No content length logged
- ❌ **NO LOGS**: No extraction method logged (readability/content-extractor/fallback)

**Status**: ❌ **NEVER INVOKED** - Content extraction code exists but is **NEVER EXECUTED** because:
1. **CRITICAL**: Citations fail verification (HTTP 403) and function returns early (line 854)
2. Early return prevents reaching content extraction code (line 870+)
3. No citations are successfully verified, so extraction **NEVER RUNS**

**Root Cause**: Verification failures cause early return, blocking all subsequent processing. **Extraction, validation, AI scoring, and save are NEVER INVOKED on failing items.**

---

### Phase 6: Content Validation ❌ NEVER INVOKED (BLOCKED BY VERIFICATION)

**What Happens:**
1. Extracted content is validated:
   - Minimum length: 500 characters (Phase 1)
   - Must be actual article: 1000+ chars, 3+ paragraphs (Phase 1)
   - Minimum 800 chars for AI scoring
2. If validation fails, citation is rejected

**Evidence from Logs:**
- ❌ **NO LOGS**: No `content_validate_fail` events logged
- ❌ **NO LOGS**: No validation failure reasons logged

**Status**: ❌ **NEVER INVOKED** - Validation code exists but is **NEVER EXECUTED** because:
1. **CRITICAL**: Citations fail verification before reaching validation
2. Early return (line 854) prevents reaching validation code
3. No citations reach validation, so it **NEVER RUNS**

**Root Cause**: Verification failures cause early return, blocking validation. **Validation is NEVER INVOKED on failing items.**

---

### Phase 7: AI Relevance Scoring ❌ NEVER INVOKED (BLOCKED BY VERIFICATION)

**What Happens:**
1. Content is sent to DeepSeek for relevance scoring
2. AI returns score (0-100) and `isRelevant` boolean
3. Score must be ≥ 60 to be considered relevant

**Evidence from Logs:**
- ❌ **NO LOGS**: No AI scores logged
- ❌ **NO LOGS**: No `scoreCitationContent` results logged
- ❌ **NO LOGS**: No DeepSeek API calls logged

**Status**: ❌ **NEVER INVOKED** - AI scoring code exists but is **NEVER EXECUTED** because:
1. **CRITICAL**: Citations fail verification before reaching AI scoring
2. Early return (line 854) prevents reaching AI scoring code (line 994+)
3. No citations reach AI scoring, so it **NEVER RUNS**

**Root Cause**: Verification failures cause early return, blocking AI scoring. **AI scoring is NEVER INVOKED on failing items.**

---

### Phase 8: Saving to DiscoveredContent ❌ NOT WORKING

**What Happens:**
1. If citation passes all checks, `saveAsContent` is called
2. Content is saved to `DiscoveredContent` table
3. Hero image generation is triggered

**Evidence from Logs:**
- ❌ **ZERO SAVED**: `[WikipediaProcessor] Completed: 0 pages, 50 citations, 0 saved` (repeated 9 times)
- ❌ **ZERO SAVED**: Final summary: `"persisted":0`, `"Novel items: 0"`
- ❌ **NO LOGS**: No `content_saved` events logged
- ❌ **NO LOGS**: No `saveAsContent` calls logged

**Status**: ❌ **NOT WORKING**

**Root Causes**:
1. Citations are failing at earlier stages (verification, extraction, validation, or AI scoring)
2. `saveAsContent` is never called because `finalIsRelevant` is never true
3. No logging to show why citations aren't being saved

---

## Critical Issues Identified

### Issue 1: HTTP 403 Verification Failures ❌ CRITICAL

**Problem**: Many citations failing verification with HTTP 403 (Forbidden)

**Evidence**:
- Repeated failures: `Citation "Official website" verification failed: HTTP 403`
- Same URL failing repeatedly: `https://www.gov.il/en/departments/prime_ministers_office/govil-landing-page`

**Impact**: 
- Citations never reach content extraction
- Infinite loop: failed citations are re-selected
- Blocks processing of valid citations

**Root Causes**:
1. Missing User-Agent headers in verification requests
2. Websites blocking automated requests
3. No retry logic for temporary failures
4. Failed citations not properly marked as processed

---

### Issue 2: Missing Structured Logging ❌ CRITICAL

**Problem**: No visibility into content extraction, validation, or AI scoring

**Missing Logs**:
- `content_extract` events (extraction method, content length)
- `content_validate_fail` events (validation failure reasons)
- `content_saved` events (successful saves)
- AI scores for processed citations
- `finalIsRelevant` decisions and reasons

**Impact**:
- Cannot diagnose why citations aren't being saved
- Cannot determine if extraction is working
- Cannot verify AI scoring is running
- Cannot identify which stage is failing

---

### Issue 3: Citation Processing Loop ⚠️ MODERATE

**Problem**: Same citation being processed repeatedly despite failures

**Evidence**:
- Same citation (`https://www.gov.il/en/departments/prime_ministers_office/govil-landing-page`) processed multiple times
- Each time fails with HTTP 403
- Citation is re-selected on next run

**Root Cause**: 
- Citations with `verificationStatus: 'failed'` are still eligible if `scanStatus: 'not_scanned'`
- When verification fails, `scanStatus` may not be updated to prevent re-selection

---

### Issue 4: No Content Extraction Evidence ❓ UNKNOWN

**Problem**: Cannot determine if content extraction is working

**Evidence**:
- No `content_extract` logs
- No content length logs
- No extraction method logs

**Possible Causes**:
1. Citations fail verification before extraction
2. Extraction is running but producing insufficient content
3. Extraction logs aren't being output
4. Extraction is failing silently

---

### Issue 5: No AI Scoring Evidence ❓ UNKNOWN

**Problem**: Cannot determine if AI scoring is working

**Evidence**:
- No AI score logs
- No DeepSeek API call logs
- No `scoreCitationContent` results

**Possible Causes**:
1. Citations fail before reaching AI scoring
2. Content extraction produces insufficient content (< 800 chars)
3. AI scoring is running but all scores are < 60
4. AI scoring logs aren't being output

---

## What's Working ✅

1. **Discovery Initialization**: ✅ Runs start successfully
2. **Wikipedia Page Fetching**: ✅ Pages are fetched and parsed
3. **Citation Extraction**: ✅ 8,827 citations extracted from 25 pages
4. **Citation Storage**: ✅ Citations stored in database
5. **Citation Selection**: ✅ Citations are being selected for processing
6. **Wikipedia Page Completion**: ✅ Pages are marked as complete when all citations processed

---

## What's Not Working ❌

1. **URL Verification**: ❌ HTTP 403 errors blocking many citations
2. **Content Extraction Visibility**: ❌ No logs to verify extraction is working
3. **Content Validation Visibility**: ❌ No logs to verify validation is working
4. **AI Scoring Visibility**: ❌ No logs to verify AI scoring is working
5. **Saving to DiscoveredContent**: ❌ 0 items saved despite processing
6. **Failed Citation Handling**: ❌ Failed citations are re-selected in a loop

---

## What's Never Invoked ❌

1. **Content Extraction**: ❌ **NEVER RUNS** - Blocked by verification failures
2. **Content Validation**: ❌ **NEVER RUNS** - Blocked by verification failures
3. **AI Scoring**: ❌ **NEVER RUNS** - Blocked by verification failures
4. **Save Function**: ❌ **NEVER RUNS** - Blocked by verification failures

**All of these stages are NEVER INVOKED because verification fails and the function returns early (line 854) before reaching any of them.**

---

## Recommendations

### Immediate Actions (High Priority)

1. **Add Comprehensive Logging**:
   - Log all `content_extract` events with method, length, paragraph count
   - Log all `content_validate_fail` events with failure reason
   - Log all AI scores for processed citations
   - Log `finalIsRelevant` decisions with all contributing factors
   - Log `saveAsContent` calls and results

2. **Fix HTTP 403 Verification Failures**:
   - Add proper User-Agent headers to verification requests
   - Implement retry logic with exponential backoff
   - Mark failed citations as `scanned` to prevent re-selection
   - Consider using GET instead of HEAD for verification

3. **Fix Citation Processing Loop**:
   - Ensure `scanStatus` is updated when verification fails
   - Mark failed citations as `scanned` with `denied` decision
   - Prevent re-selection of permanently failed citations

### Medium Priority

4. **Verify Content Extraction**:
   - Test if Readability/ContentExtractor are working on Render
   - Verify extracted content meets minimum length requirements
   - Check if extraction is producing meaningful article text

5. **Review AI Scoring**:
   - Sample rejected citations and manually verify scores
   - Check if DeepSeek API is returning reasonable scores
   - Verify threshold (60) is appropriate

### Low Priority

6. **Optimize Processing**:
   - Process citations in batches more efficiently
   - Prioritize citations with higher AI scores
   - Skip permanently failed citations

---

## Next Steps

1. **Add Logging First**: Before making any other changes, add comprehensive logging to diagnose the issue
2. **Fix Verification**: Address HTTP 403 errors to allow citations to proceed
3. **Verify Extraction**: Test content extraction on Render environment
4. **Review Scores**: Check AI scoring accuracy and threshold
5. **Fix Save Function**: Ensure `saveAsContent` is being called and working

---

## Summary

The discovery process is **partially working**:
- ✅ Initialization and Wikipedia processing work
- ✅ Citation extraction and storage work
- ❌ **URL verification is failing (HTTP 403) - CRITICAL BLOCKER**
- ❌ **Content extraction never runs** (blocked by verification failures)
- ❌ **AI scoring never runs** (blocked by verification failures)
- ❌ **Nothing is being saved** (0 items persisted)

**Primary Blocker**: 
**HTTP 403 verification failures cause early return (line 854), preventing citations from reaching content extraction (line 870+). This is why we see:**
- No `content_extract` logs (extraction code never reached)
- No AI scoring logs (scoring code never reached)
- No `content_saved` logs (save code never reached)
- 0 items saved (nothing passes verification)

**The verification step is the single point of failure blocking the entire pipeline.**

