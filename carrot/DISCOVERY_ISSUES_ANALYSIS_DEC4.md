# Discovery Issues Analysis - December 4, 2025

## Summary
- **8,839 citations extracted** but **0 saved**
- **8,683 citations stuck** in `pending / not_scanned` state
- **Only 15 citations processed** (all denied)
- **Discovery running but not saving anything**

## Critical Issues Found

### 1. Wikipedia Page Title is Undefined
**Error**: `[WikipediaProcessor] Processing Wikipedia page: undefined`
**Location**: Logs show this when processing citations
**Impact**: Cannot fetch Wikipedia page content, citations fail to process
**Root Cause**: The `wikipediaTitle` field is not being passed correctly to the processor

### 2. Citation Prioritization Failing
**Error**: `SyntaxError: Unterminated string in JSON at position 2974`
**Location**: `[EngineV21] Citation prioritization failed`
**Impact**: Citations are not being prioritized, using default order
**Root Cause**: DeepSeek API response has malformed JSON (unterminated string)

### 3. Processing Wikipedia Internal Links Instead of External URLs
**Issue**: System is processing relative Wikipedia links like:
- `./Languages_of_Israel`
- `./Hebrew_language`
- `./Arabic_language_in_Israel`
- `./Racism_in_Israel`

**Impact**: These are being scored (all getting score 30, below threshold of 60) and denied
**Root Cause**: The extraction is including Wikipedia internal links in the citations table

### 4. Citations Stuck in `pending / not_scanned`
**Count**: 8,683 citations
**Status**: `pending / not_scanned / null`
**Impact**: These citations are never being processed
**Root Cause**: The `getNextCitationToProcess` query may be too restrictive, or the processing loop is not running

### 5. Only 15 Citations Processed, All Denied
**Processed**: 15 citations
**Saved**: 0
**Denied**: 12
**With Errors**: 11

**Reasons for denial**:
- Low-quality URLs (library catalogs, metadata pages)
- HTTP 403 errors (both HEAD and GET failed)
- Wikipedia internal links (score: 30, below threshold of 60)
- HTTP 0 errors (both HEAD and GET failed)

## Diagnosis Results

### Citation Status Breakdown
- **Total citations**: 8,839
- **Pending/not_scanned**: 8,683 (98.2%)
- **Failed/scanned_denied**: 141 (1.6%)
- **Verified/scanned/denied**: 11 (0.1%)
- **Failed/scanned/denied**: 4 (0.05%)

### Processed Citations Analysis
- **With content extracted**: 9
- **With AI score**: 14
- **Saved**: 0
- **Denied**: 12
- **With errors**: 11

### Sample Errors
1. `https://commons.wikimedia.org/wiki/ישראל%20/%20إسرائيل` - Low-quality URL
2. `https://www.wikidata.org/wiki/Q801` - Low-quality URL
3. `https://www.gov.il/en/departments/prime_ministers_office/gov...` - HTTP 403
4. `./Prime_Minister` - Wikipedia internal link (score: 30)
5. `https://www.cbs.gov.il/en/Pages/default.aspx` - HTTP 0 (both HEAD and GET failed)

## Root Causes

### Primary Issue: Wikipedia Internal Links in Citations Table
The extraction is storing Wikipedia internal links (relative paths like `./Languages_of_Israel`) in the `wikipedia_citations` table. These should be filtered out during extraction, not stored and processed.

### Secondary Issue: Processing Loop Not Running
The `processWikipediaIncremental` function is being called, but it's processing Wikipedia internal links instead of external URLs. The system should be processing external URLs from the citations table.

### Tertiary Issue: Citation Prioritization Failing
The DeepSeek API is returning malformed JSON, causing prioritization to fail. This means citations are processed in default order, not by priority.

## Recommended Fixes

### Fix 1: Filter Wikipedia Internal Links During Extraction
**File**: `carrot/src/lib/discovery/wikiUtils.ts`
**Action**: Ensure `extractWikipediaCitationsWithContext` filters out Wikipedia internal links before storing them

### Fix 2: Fix Wikipedia Page Title Undefined
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`
**Action**: Ensure `wikipediaTitle` is correctly passed when calling `processWikipediaIncremental`

### Fix 3: Fix Citation Prioritization JSON Parsing
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`
**Action**: Add better error handling for malformed JSON responses from DeepSeek API

### Fix 4: Ensure External URLs Are Processed
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`
**Action**: Verify that `getNextCitationToProcess` only returns external URLs, not Wikipedia internal links

### Fix 5: Re-extract Citations (Clean Up Internal Links)
**Action**: Run a cleanup script to remove Wikipedia internal links from the citations table, then re-extract with the fixed extraction logic

## Next Steps

1. ✅ Run diagnosis script (completed)
2. ⏳ Fix Wikipedia internal link filtering in extraction
3. ⏳ Fix undefined Wikipedia page title
4. ⏳ Fix citation prioritization JSON parsing
5. ⏳ Clean up existing Wikipedia internal links from database
6. ⏳ Re-extract citations with fixed logic
7. ⏳ Test discovery run

