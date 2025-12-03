# Discovery Issues from Render Logs

## Critical Issue: Nothing Being Saved

**From logs (line 7026, 7045):**
```
"persisted":0
"Novel items: 0"
```

**Discovery Run Summary:**
- **Processed**: 8 URLs
- **Saved**: 0 items
- **Duplicates**: 1
- **Failures**: 0
- **Duration**: 384 seconds

**Wikipedia Processor Summary (line 1327):**
```
[WikipediaProcessor] Completed: 0 pages, 50 citations, 0 saved
```
- Processed 50 citations but saved 0

## Root Causes Identified

### 1. Content Extraction Quality Issues
**Problem**: Content extraction is likely producing insufficient content that fails validation checks.

**Evidence**:
- 50 citations processed but 0 saved
- No failures logged, suggesting content is being extracted but rejected during validation

**Likely Causes**:
- Content extraction chain (Readability → ContentExtractor → fallback) may not be working properly on Render
- Extracted content may be too short (< 500 characters)
- Content may not pass `isActualArticle` check (requires 1000+ chars and 3+ paragraphs)

**Fix Needed**:
- Verify content extraction is working on Render environment
- Check if Readability/ContentExtractor libraries are available
- Add more detailed logging for content extraction failures
- Lower minimum content length threshold if appropriate (currently 500 chars for Phase 1, 800 for AI scoring)

### 2. AI Scoring Threshold Too High
**Problem**: AI relevance scoring threshold (60) may be rejecting all content.

**Evidence**:
- Citations are being processed (50 processed)
- No failures logged (content is being extracted)
- Nothing saved (all rejected by AI scoring)

**Likely Causes**:
- AI scores are below 60 threshold
- Content may be relevant but scoring is too strict
- DeepSeek API may be returning lower scores than expected

**Fix Needed**:
- Add logging to show AI scores for rejected citations
- Review sample of rejected citations to verify scoring accuracy
- Consider temporary threshold adjustment for testing (but user explicitly said not to lower quality threshold)
- Verify DeepSeek API is working correctly on Render

### 3. HTTP 403 Errors on Citation Verification
**Problem**: Many citations failing verification with HTTP 403 (Forbidden).

**Evidence** (lines 1080-1324):
```
[WikipediaProcessor] Citation "Official website" verification failed: HTTP 403
```
- Repeated HTTP 403 errors for "Official website" citations
- These citations are marked as `verificationStatus: 'failed'` but may still be processable

**Likely Causes**:
- Websites blocking automated requests
- Missing or incorrect User-Agent headers
- Rate limiting or IP blocking

**Fix Needed**:
- Add proper User-Agent headers to citation verification requests
- Implement retry logic with exponential backoff
- Consider using proxy or different request strategy for blocked sites
- Mark 403 errors as potentially retryable (not permanently failed)

### 4. Wikipedia Citation Processing Not Saving
**Problem**: Wikipedia citations are being processed but not saved to DiscoveredContent.

**Evidence**:
- `processWikipediaIncremental` processed 50 citations
- 0 saved to DiscoveredContent
- No errors logged

**Likely Causes**:
- Citations may be failing relevance checks
- Content extraction may be producing insufficient content
- AI scoring may be rejecting all citations
- `saveAsContent` function may not be called or may be failing silently

**Fix Needed**:
- Add detailed logging in `saveAsContent` to see why citations aren't being saved
- Log AI scores for all processed citations
- Log content length for all processed citations
- Verify `finalIsRelevant` logic is working correctly
- Check if `enrichContentId` is being called and succeeding

### 5. Discovery Engine Processing But Not Finding Novel Content
**Problem**: Discovery engine is processing URLs but finding 0 novel items.

**Evidence**:
- 8 URLs processed
- 1 duplicate found
- 0 novel items saved
- 0 failures (suggesting content was extracted but rejected)

**Likely Causes**:
- All content is being rejected by relevance engine
- Content quality checks are failing
- Deduplication may be too aggressive
- Content extraction may be producing empty/invalid content

**Fix Needed**:
- Add logging to show why content is being rejected at each stage
- Log relevance scores for all processed URLs
- Verify deduplication logic isn't incorrectly marking content as duplicates
- Check if content extraction is producing valid content

## Immediate Actions Needed

1. **Add Comprehensive Logging**:
   - Log AI scores for all processed citations
   - Log content length for all processed citations
   - Log reason for rejection at each validation stage
   - Log `finalIsRelevant` decision and all contributing factors

2. **Verify Content Extraction**:
   - Test if Readability/ContentExtractor are working on Render
   - Check if extracted content meets minimum length requirements
   - Verify content quality checks are not too strict

3. **Review AI Scoring**:
   - Sample rejected citations and manually verify if they should be saved
   - Check if DeepSeek API is returning reasonable scores
   - Consider if threshold needs adjustment (but maintain quality)

4. **Fix HTTP 403 Issues**:
   - Add proper User-Agent headers
   - Implement retry logic
   - Mark 403 as retryable, not permanent failure

5. **Debug Save Function**:
   - Add logging to `saveAsContent` to see if it's being called
   - Log all conditions that prevent saving
   - Verify database writes are succeeding

## Testing Plan

1. Run discovery with enhanced logging
2. Check logs for:
   - Content extraction success/failure
   - Content lengths
   - AI scores
   - Reasons for rejection
3. Manually verify a sample of rejected citations
4. Adjust thresholds/logic based on findings
5. Re-run discovery and verify items are being saved

## Notes

- User explicitly stated: "we didn't find anything" - this confirms the issue
- User also said: "before we push to git" - so this needs to be fixed before the next deployment
- The 3-stage content extraction chain was recently implemented - may need verification it's working on Render
- The relevance threshold was reverted to 60 (from 40) - may need review if all content is being rejected

