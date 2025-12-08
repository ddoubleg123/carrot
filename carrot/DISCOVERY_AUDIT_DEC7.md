# Discovery Process Full Audit - December 7, 2025

## Executive Summary

The discovery process is **running but not saving any content**. The system is processing Wikipedia citations, extracting content, and scoring it, but **all content is being rejected** due to a logic flaw in the final relevance decision.

**Key Finding**: High-quality, relevant content (score 85-95 from DeepSeek AI) is being rejected because the `RelevanceEngine` secondary validation is too strict and incorrectly overrides DeepSeek's correct assessment.

---

## 1. Process Flow Analysis

### 1.1 Discovery Engine Startup
✅ **Working**: Discovery engine v2.1 starts successfully
- Run ID: `cmiwb5hj60001ov2bnuunjjz6`
- Patch: `israel` (cmip4pwb40001rt1t7a13p27g)
- Wikipedia page processing initiated

### 1.2 Wikipedia Page Processing
✅ **Working**: Wikipedia pages are being discovered and processed
- Processing page: "Apartheid Museum"
- Processing page: "Israel Defense Forces"
- Processing page: "Israeli–Palestinian conflict"
- Processing page: "Israeli apartheid"
- Processing page: "Israel–Hezbollah conflict (2023–present)"

### 1.3 Citation Extraction
✅ **Working**: Citations are being extracted from Wikipedia pages
- Example: 50 citations extracted from "Israel" page
- Citations are being prioritized by AI
- Citations are being queued for processing

### 1.4 Content Extraction
✅ **Working**: Content is being extracted from citation URLs
- Using `readability` method for most pages
- Using `fallback-strip` for pages that fail readability
- Content extraction is successful for most URLs

### 1.5 AI Scoring (DeepSeek)
✅ **Working**: DeepSeek AI is scoring content correctly
- API calls to DeepSeek are successful (HTTP 200)
- Scoring is accurate and detailed
- Examples from logs:
  - **IDF Wiktionary article**: Score 85, isRelevant: true ✅
  - **Al Jazeera article**: Score 95, isRelevant: true ✅
  - **Metadata pages**: Score 30, isRelevant: false ✅ (correctly rejected)

### 1.6 RelevanceEngine Validation
⚠️ **PROBLEM**: RelevanceEngine is too strict
- Scoring content but with very low scores (0.4)
- Marking content as `isRelevant: false` even when DeepSeek says relevant
- Examples:
  - IDF article: DeepSeek 85/true → RelevanceEngine 0.4/false
  - Al Jazeera article: DeepSeek 95/true → RelevanceEngine 0.4/false

### 1.7 Final Relevance Decision
❌ **CRITICAL BUG**: Final decision logic is rejecting valid content

**Current Logic** (from `wikipediaProcessor.ts:1479-1480`):
```typescript
const finalIsRelevant = isRelevantFromDeepSeek && 
  (!relevanceEngineResult || relevanceEngineResult.isRelevant || relevanceEngineResult.score >= 0.5)
```

**Problem**: 
- DeepSeek says: `score: 85, isRelevant: true` ✅
- RelevanceEngine says: `score: 0.4, isRelevant: false` ❌
- Since `0.4 < 0.5`, the condition fails → Content rejected ❌

**Result**: All high-quality content is being rejected even though DeepSeek correctly identifies it as relevant.

### 1.8 Content Saving
❌ **NOT WORKING**: No content is being saved
- Logs show: `"persisted":0` in all heartbeat messages
- Logs show: `"saved":0` in all discovery engine events
- All citations are marked as "rejected (not relevant - content stored for audit)"

---

## 2. Detailed Log Analysis

### 2.1 Successful Content Extraction Examples

**Example 1: IDF Wiktionary Article**
```
URL: https://en.wiktionary.org/wiki/IDF
Title: "IDF - Wiktionary, the free dictionary"
Content: 3,924 bytes, 1 paragraph
DeepSeek Score: 85, isRelevant: true ✅
RelevanceEngine Score: 0.4, isRelevant: false ❌
Final Decision: NOT RELEVANT ❌
Result: REJECTED
```

**Example 2: Al Jazeera Article**
```
URL: https://aljazeera.com/news/longform/2024/4/15/mapping-israel-lebanon-cross-border-attacks
Title: "Mapping Israel-Lebanon cross-border attacks"
Content: 17,428 bytes, 1 paragraph
DeepSeek Score: 95, isRelevant: true ✅
RelevanceEngine Score: 0.4, isRelevant: false ❌
Final Decision: NOT RELEVANT ❌
Result: REJECTED
```

### 2.2 Correct Rejections (Working as Intended)

**Example: Metadata/Catalog Pages**
```
URL: https://d-nb.info/gnd/1031708-9
Title: "GND"
Content: 2,820 bytes
DeepSeek Score: 30, isRelevant: false ✅
RelevanceEngine Score: 0.4, isRelevant: false ✅
Final Decision: NOT RELEVANT ✅
Result: REJECTED (correctly)
```

### 2.3 Content Validation Failures

**Insufficient Content** (Working as intended):
- URLs with < 500 chars are rejected
- URLs with < 600 chars are rejected before AI scoring
- Examples: `https://www.idf.il/en` (0 chars), `https://cantic.bnc.cat/...` (6 chars)

**PDF Binary Data** (Working as intended):
- PDF files that can't be parsed are rejected
- Example: `https://www.pewresearch.org/.../256topline.pdf` (score: 5)

### 2.4 Database Errors

**UTF-8 Encoding Error**:
```
Error: invalid byte sequence for encoding "UTF8": 0x00
Location: prisma.wikipediaCitation.update()
```
- This occurs when trying to save content with null bytes
- **Impact**: One citation failed to update, but processing continued

### 2.5 Citation Prioritization

✅ **Working**: AI prioritization is functioning
- 50 citations extracted from "Israel" page
- 25 citations prioritized by DeepSeek
- Top 5 prioritized URLs logged

⚠️ **Issue**: JSON parsing error in prioritization
```
SyntaxError: Unterminated string in JSON at position 3870
```
- **Impact**: Falls back to original order (non-fatal)

---

## 3. Metrics Summary

### 3.1 Discovery Engine Metrics (from heartbeats)
- **Fetched**: 2 URLs
- **Enqueued**: 0 URLs
- **Deduplicated**: 0 URLs
- **Skipped**: 0 URLs
- **Persisted**: 0 URLs ❌
- **Errors**: 0 (except UTF-8 encoding error)

### 3.2 Wikipedia Processing Metrics
- **Pages Scanned**: 25 pages
- **Citations Extracted**: 8,839 citations
- **Citations Processed**: 74 citations
- **Citations Saved**: 0 citations ❌

### 3.3 Content Quality Metrics
- **High Score Content** (85-95): Multiple examples found
- **Rejected High Score Content**: All high-score content rejected
- **Correctly Rejected Low Score**: Metadata pages correctly rejected

---

## 4. Root Cause Analysis

### 4.1 Primary Issue: Final Relevance Decision Logic

**Location**: `carrot/src/lib/discovery/wikipediaProcessor.ts:1479-1480`

**Current Code**:
```typescript
const finalIsRelevant = isRelevantFromDeepSeek && 
  (!relevanceEngineResult || relevanceEngineResult.isRelevant || relevanceEngineResult.score >= 0.5)
```

**Problem**: 
1. DeepSeek (primary scorer) correctly identifies content as relevant (score 85-95)
2. RelevanceEngine (secondary validator) gives low scores (0.4) and marks as not relevant
3. The logic requires BOTH DeepSeek AND RelevanceEngine to agree
4. Since RelevanceEngine score (0.4) < 0.5 threshold, content is rejected
5. **Result**: All valid content is rejected

**Why RelevanceEngine is Failing**:
- RelevanceEngine is designed for entity matching (e.g., "Chicago Bulls")
- It looks for specific entity names, people, places, keywords
- For "Israel" patch, it may not have a proper entity profile built
- It's giving low scores (0.4) even when content is clearly about Israel

### 4.2 Secondary Issues

1. **RelevanceEngine Entity Profile**: May not be properly built for "Israel" patch
2. **RelevanceEngine Scoring**: Too strict - 0.4 score threshold may be too high
3. **JSON Parsing**: Citation prioritization sometimes fails (non-fatal)

---

## 5. Impact Assessment

### 5.1 Current State
- ✅ Discovery process is running
- ✅ Content extraction is working
- ✅ AI scoring (DeepSeek) is accurate
- ❌ **No content is being saved**
- ❌ **All high-quality content is being rejected**

### 5.2 User Impact
- **Dashboard shows**: "CITATIONS SAVED: 0"
- **No content appears** in the discovery feed
- **Discovery appears broken** even though it's processing

### 5.3 System Impact
- Processing resources are being used
- API calls to DeepSeek are being made (costs money)
- Database operations are happening
- But **no value is being created** (no content saved)

---

## 6. Recommended Fix Plan

### 6.1 Immediate Fix (Priority 1)

**Fix the Final Relevance Decision Logic**

**Option A: Trust DeepSeek as Primary** (Recommended)
- If DeepSeek says relevant (score >= 60, isRelevant: true), accept it
- Use RelevanceEngine only as a warning/advisory, not a blocker
- Only reject if RelevanceEngine strongly disagrees (e.g., score < 0.2)

**Option B: Lower RelevanceEngine Threshold**
- Change threshold from 0.5 to 0.3 or 0.2
- This would allow content with RelevanceEngine score 0.4 to pass

**Option C: Make RelevanceEngine Optional**
- If RelevanceEngine fails or gives low scores, trust DeepSeek
- Only use RelevanceEngine when it's confident (score >= 0.6)

**Recommended Code Change**:
```typescript
// Trust DeepSeek as primary, use RelevanceEngine as advisory only
const finalIsRelevant = isRelevantFromDeepSeek && 
  (!relevanceEngineResult || 
   relevanceEngineResult.isRelevant || 
   relevanceEngineResult.score >= 0.2) // Lower threshold from 0.5 to 0.2
```

### 6.2 Secondary Fixes (Priority 2)

1. **Fix RelevanceEngine Entity Profile for "Israel"**
   - Ensure entity profile is properly built
   - Add "Israel" as primary entity
   - Add related entities (IDF, Jerusalem, etc.)

2. **Improve RelevanceEngine Scoring**
   - Review why it's giving 0.4 scores for clearly relevant content
   - May need to adjust entity matching logic

3. **Add Better Logging**
   - Log why final decision was made
   - Log RelevanceEngine entity profile status
   - Log matched entities

### 6.3 Long-term Improvements (Priority 3)

1. **Make RelevanceEngine Optional**
   - Consider making it truly optional (can be disabled)
   - Or make it advisory-only (logs warnings but doesn't block)

2. **Improve Error Handling**
   - Handle UTF-8 encoding errors gracefully
   - Filter null bytes from content before saving

3. **Fix JSON Parsing**
   - Improve citation prioritization JSON parsing
   - Add better error recovery

---

## 7. Testing Plan

### 7.1 After Fix Implementation

1. **Run Discovery Process**
   - Start discovery for "Israel" patch
   - Monitor logs for content being saved

2. **Verify Content Saving**
   - Check that high-score content (85+) is saved
   - Verify "CITATIONS SAVED" count increases
   - Check that content appears in discovery feed

3. **Verify Rejections Still Work**
   - Ensure low-score content (30) is still rejected
   - Ensure metadata pages are still rejected
   - Ensure insufficient content is still rejected

4. **Monitor Metrics**
   - Check "persisted" count in heartbeats
   - Check "saved" count in discovery events
   - Monitor API costs (DeepSeek calls)

---

## 8. Conclusion

The discovery process is **functionally working** but **not saving any content** due to a logic flaw in the final relevance decision. The fix is straightforward: adjust the final relevance decision logic to trust DeepSeek as the primary scorer and use RelevanceEngine as advisory only.

**Estimated Fix Time**: 15-30 minutes
**Risk Level**: Low (fixing logic, not changing core functionality)
**Impact**: High (will immediately start saving content)

---

## Appendix: Key Log Entries

### Successful AI Scoring (But Rejected)
```
[WikipediaProcessor] DeepSeek content scoring for "Definitions": {
  score: 85,
  isRelevant: true,
  reason: "This is an actual Wiktionary article that includes 'Israel Defense Forces'..."
}
[WikipediaProcessor] RelevanceEngine validation: {
  score: 0.4,
  isRelevant: false,
  matchedEntities: [ 'Israel' ],
  reason: 'Insufficient relevance score or missing group mentions'
}
[WikipediaProcessor] Final relevance decision: {
  deepSeekScore: 85,
  deepSeekRelevant: true,
  relevanceEngineScore: 0.4,
  relevanceEngineRelevant: false,
  finalDecision: 'NOT RELEVANT' ❌
}
```

### High-Quality Content Rejected
```
[WikipediaProcessor] Citation "null" rejected: This is a substantive, detailed article from Al Jazeera that directly focuses on Israel's military conflict with Hezbollah... (score: 95, isRelevant: true)
```

### Discovery Metrics (All Zeros)
```
{"ts":"2025-12-07T22:43:38.990Z","level":"info","step":"discovery","msg":"heartbeat","persisted":0,"errors":0}
```

