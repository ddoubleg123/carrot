# Discovery Error Analysis - Israel Patch

## Issues Identified

### 1. **Main Discovery Engine Error** ❌
**Error**: "Candidate processing failed"
- This is from the main discovery engine (not Wikipedia citations)
- Occurs in `engineV21.ts:3143` when processing regular candidates
- The error is caught and logged, but discovery continues

**Possible Causes**:
- Network timeout during fetch
- Paywall/robots.txt blocking
- Content extraction failure
- Database save error

### 2. **Wikipedia Citations Not Being Saved** ⚠️
**Status**: 49 citations processed, 0 saved

**Root Cause**: All citations are being denied because:
- **AI Scores too low**: Most citations scored 30 (below 60 threshold)
- **Scoring failures**: Some citations have `aiPriorityScore: N/A` (scoring failed)
- **Content validation**: Some citations have very short content (7 chars, 90 chars, etc.)

**Sample Processed Citations**:
1. "Policy publications..." - Score: N/A, Content: 7 chars → **DENIED**
2. "Website with information..." - Score: 30, Content: 4179 chars → **DENIED** (score < 60)
3. "What the Fight in Israel Is All About" - Score: 30, Content: 31576 chars → **DENIED** (score < 60)
4. "True Peace" - Score: N/A, Content: 90 chars → **DENIED**
5. "Honest Reporting" - Score: 30, Content: 12335 chars → **DENIED** (score < 60)

**All 20 processed citations have**:
- `relevanceDecision: 'denied'`
- `savedContentId: null`
- `savedMemoryId: null`

## Why Citations Are Being Denied

### Issue 1: AI Scoring Too Strict
- Threshold: 60/100
- Most citations scoring: 30/100
- **Problem**: DeepSeek is scoring citations too low, even for relevant content

### Issue 2: Scoring Failures
- Some citations have `aiPriorityScore: N/A`
- This means DeepSeek API call failed or returned invalid response
- **Problem**: Scoring is failing silently, citations default to denied

### Issue 3: Content Length Issues
- Some citations have very short content (7 chars, 90 chars)
- These fail the `MIN_CONTENT_LENGTH` check (currently 500 chars)
- **Note**: I changed this to 1000 in the fix, but it may not be deployed yet

## Recommendations

### Fix 1: Lower the Relevance Threshold (Temporary)
- Current: 60/100
- Suggested: 40-50/100 for initial testing
- This will allow more citations to be saved while we debug scoring

### Fix 2: Improve Error Handling for Scoring Failures
- When DeepSeek scoring fails, don't default to denied
- Log the error and retry, or use a fallback scoring method
- Currently, `N/A` scores result in automatic denial

### Fix 3: Check DeepSeek API
- Verify DeepSeek API key is working
- Check API rate limits
- Verify the scoring prompt is correct

### Fix 4: Review Content Extraction
- Some citations have very short content (7 chars)
- This suggests content extraction is failing
- May need better HTML parsing

## Next Steps

1. Check Render logs for the actual error message from "Candidate processing failed"
2. Check DeepSeek API status and logs
3. Review why citations are scoring so low (30 vs 60 threshold)
4. Consider temporarily lowering threshold to 40-50 for testing

