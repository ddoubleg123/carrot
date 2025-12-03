# Wikipedia Processing Flow - Comprehensive Analysis

## Executive Summary

**Status**: KPIs are updating (good sign), but no new articles appearing on frontend.

**Key Finding**: The system is processing citations, but there may be issues with:
1. DeepSeek scoring threshold (60) may be too strict
2. Content may not be marked as `isUseful: true`
3. Frontend API may not be filtering correctly
4. AgentMemory may not be saving correctly

## What's Working ✅

### 1. Wikipedia Monitoring Initialization
- ✅ Wikipedia pages are being monitored for patches
- ✅ Pages are being scanned and citations extracted
- ✅ Citations are being stored in database

### 2. Citation Processing Flow
- ✅ Citations are being fetched from URLs
- ✅ Content is being extracted from HTML
- ✅ Content is being stored in `WikipediaCitation.contentText`
- ✅ DeepSeek is being called to score content
- ✅ Scores are being stored in `WikipediaCitation.aiPriorityScore`

### 3. Discovery Engine Integration
- ✅ `processWikipediaIncremental` is being called periodically (every 30 seconds or every 10 candidates)
- ✅ Integration with `engineV21.ts` is working
- ✅ KPIs are updating (indicating processing is happening)

## What's NOT Working ❌

### 1. Articles Not Appearing on Frontend

**Potential Issues:**

#### Issue A: DeepSeek Score Threshold Too Strict
- **Location**: `wikipediaProcessor.ts:568`
- **Current Threshold**: Score >= 60 AND `isRelevant === true`
- **Problem**: Many citations may be scoring below 60, causing them to be rejected
- **Evidence Needed**: Check actual score distribution

#### Issue B: `isUseful` Flag Not Set Correctly
- **Location**: `engineV21.ts:627`
- **Current Logic**: `isUseful: relevanceData?.isRelevant ?? false`
- **Problem**: If `relevanceData.isRelevant` is not explicitly `true`, it defaults to `false`
- **Impact**: Articles saved to DiscoveredContent but `isUseful=false` may not appear on frontend

#### Issue C: Frontend API Filtering
- **Location**: `discovered-content/route.ts`
- **Current Behavior**: API returns ALL items (no filtering by `isUseful`)
- **Status**: ✅ API doesn't filter - this is correct
- **Note**: Frontend may be filtering, but API should return everything

### 2. AgentMemory May Not Be Saving

**Potential Issues:**

#### Issue D: Agent Not Found
- **Location**: `engineV21.ts:665-702`
- **Current Logic**: Auto-creates agent if none exists
- **Status**: ✅ Should work, but need to verify

#### Issue E: Memory Not Being Saved
- **Location**: `wikipediaProcessor.ts:652-660`
- **Current Logic**: Only saves if `finalIsRelevant === true`
- **Problem**: If DeepSeek rejects, memory is not saved
- **Impact**: Agent won't have knowledge even if content is somewhat relevant

### 3. Content Scoring Issues

#### Issue F: DeepSeek Scoring May Be Failing
- **Location**: `wikipediaProcessor.ts:29-104`
- **Potential Problems**:
  - JSON parsing errors
  - API timeouts
  - Invalid responses
- **Fallback**: Defaults to `score: 50, isRelevant: false` on error
- **Impact**: All citations fail if DeepSeek is down

#### Issue G: Content Validation Too Strict
- **Location**: `wikipediaProcessor.ts:541-556`
- **Current Requirement**: Minimum 500 characters
- **Status**: ✅ Reasonable threshold
- **Note**: May reject some valid short articles

## Data Flow Analysis

### Current Flow:

```
1. Discovery Engine Running
   └─> Calls processWikipediaIncremental() every 30s or every 10 candidates
       └─> processNextWikipediaPage() - Phase 1
           └─> Extracts citations, stores with aiPriorityScore: null
       └─> processNextCitation() - Phase 2
           └─> Fetches content
           └─> Validates content (>= 500 chars)
           └─> Calls scoreCitationContent() with actual content
           └─> Gets score from DeepSeek
           └─> Checks: score >= 60 AND isRelevant === true
           └─> If relevant:
               ├─> saveAsContent() → DiscoveredContent
               │   └─> Sets isUseful: relevanceData?.isRelevant ?? false
               └─> saveAsMemory() → AgentMemory
```

### Potential Breakpoints:

1. **DeepSeek Scoring**: If score < 60, citation is rejected
2. **isRelevant Flag**: If DeepSeek returns `isRelevant: false`, citation is rejected
3. **isUseful Flag**: If not explicitly set to `true`, article may not appear
4. **AgentMemory**: Only saves if `finalIsRelevant === true`

## Diagnostic Steps

### Step 1: Run Analysis Script
```bash
npx tsx scripts/analyze-wikipedia-flow.ts [patchHandle]
```

This will show:
- How many citations have been processed
- Score distribution
- How many are saved vs denied
- Whether AgentMemory is being populated

### Step 2: Check Database Directly

```sql
-- Check citations with scores
SELECT 
  citation_title,
  ai_priority_score,
  verification_status,
  scan_status,
  relevance_decision,
  saved_content_id,
  saved_memory_id
FROM wikipedia_citations
WHERE monitoring_id IN (
  SELECT id FROM wikipedia_monitoring WHERE patch_id = '[PATCH_ID]'
)
ORDER BY ai_priority_score DESC NULLS LAST
LIMIT 20;

-- Check DiscoveredContent
SELECT 
  title,
  is_useful,
  relevance_score,
  category,
  created_at
FROM discovered_content
WHERE patch_id = '[PATCH_ID]'
  AND category = 'wikipedia_citation'
ORDER BY created_at DESC
LIMIT 20;

-- Check AgentMemory
SELECT 
  source_title,
  source_url,
  LENGTH(content) as content_length,
  tags,
  created_at
FROM agent_memories
WHERE source_type = 'wikipedia_citation'
  AND tags @> '["[PATCH_HANDLE]"]'
ORDER BY created_at DESC
LIMIT 20;
```

### Step 3: Check Logs

Look for:
- `[WikipediaProcessor] Scoring citation content...` - Are citations being scored?
- `[WikipediaProcessor] Final relevance decision...` - What are the scores?
- `[WikipediaProcessor] Citation processed: saved to database` - Are citations being saved?
- `[WikipediaProcessor] Saved citation to DiscoveredContent` - Are they in DiscoveredContent?

## Recommended Fix Plan

### Priority 1: Verify What's Actually Happening

**Action**: Run the analysis script to get actual data
```bash
npx tsx scripts/analyze-wikipedia-flow.ts chicago-bulls
```

**Expected Output**:
- Score distribution
- How many citations are being saved vs denied
- Whether AgentMemory is being populated

### Priority 2: Adjust Scoring Threshold (If Needed)

**If scores are mostly 50-59**:
- Lower threshold from 60 to 50
- Or make threshold configurable per patch

**Location**: `wikipediaProcessor.ts:568`
```typescript
// Current:
const isRelevantFromDeepSeek = scoringResult.isRelevant && aiPriorityScore >= 60

// Potential fix:
const isRelevantFromDeepSeek = scoringResult.isRelevant && aiPriorityScore >= 50
```

### Priority 3: Fix isUseful Flag

**Issue**: `isUseful` may not be set correctly

**Location**: `engineV21.ts:627`
```typescript
// Current:
isUseful: relevanceData?.isRelevant ?? false

// Fix:
isUseful: relevanceData?.isRelevant === true  // Explicit check
```

### Priority 4: Ensure AgentMemory is Saving

**Verify**: Check if agents exist for the patch
**Verify**: Check if `saveAsMemory` is being called
**Verify**: Check if memories are being created

### Priority 5: Add Better Logging

**Add logging for**:
- DeepSeek score distribution
- Reasons for rejection
- isUseful flag values
- AgentMemory save success/failure

## Questions to Answer

1. **Are citations being scored?** 
   - Check `citationsWithScore` count

2. **What are the actual scores?**
   - Check score distribution (how many >= 60, how many < 60)

3. **Are citations being saved to DiscoveredContent?**
   - Check `savedCitations` count

4. **Are they marked as useful?**
   - Check `isUseful` flag in DiscoveredContent

5. **Is AgentMemory being populated?**
   - Check `citationsInMemory` count

6. **Is the frontend filtering correctly?**
   - Check frontend code for any `isUseful` filtering

## Next Steps

1. **Run analysis script** to get actual data
2. **Review the output** to identify specific issues
3. **Create targeted fixes** based on findings
4. **Test fixes** with a small batch of citations
5. **Monitor results** and adjust as needed

---

**Note**: This analysis is based on code review. Actual data from the database will provide definitive answers.

