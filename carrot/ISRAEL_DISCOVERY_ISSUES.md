# Israel Patch - Discovery Issues Analysis

## Current Status

### Wikipedia Citations:
- ✅ **7,578 citations extracted** from 25 pages
- ⚠️ **49 citations processed** (only 0.6% of extracted)
- ❌ **0 citations saved** (0% save rate)
- ❌ **0 agent memories** created

### Main Discovery Engine:
- ❌ **"Candidate processing failed"** error
- Status shows "Error" with "0 processed"

## Root Causes

### Issue 1: All Citations Being Denied
**Why**: All 20 processed citations have:
- `relevanceDecision: 'denied'`
- `savedContentId: null`
- `savedMemoryId: null`

**Reasons for denial**:
1. **Low AI Scores**: Most scored **30/100** (below 60 threshold)
   - Examples: "Honest Reporting" (30), "Jerusalem Center" (30), "Human Rights Watch" (30)
2. **Scoring Failures**: Some have `aiPriorityScore: N/A`
   - Examples: "Policy publications..." (N/A), "True Peace" (N/A)
3. **Insufficient Content**: Some have very short content
   - Examples: "Policy publications..." (7 chars), "True Peace" (90 chars)

### Issue 2: Main Discovery Engine Error
**Error**: "Candidate processing failed"
- This is a catch-all error from `engineV21.ts:3143`
- Occurs when processing regular discovery candidates (not Wikipedia)
- Error is logged but discovery continues

## Why Citations Score So Low

Looking at the processed citations, they're all relevant to Israel/Palestine:
- "Honest Reporting" - Israeli media watchdog
- "Jerusalem Center for Public Affairs" - Israeli think tank
- "Human Rights Watch: Israel/Palestine" - Human rights reports
- "A history of Israel, Palestine and the Arab-Israeli Conflict" - Historical content

**But they're all scoring 30/100**, which suggests:
1. DeepSeek scoring prompt may be too strict
2. Content extraction may be incomplete
3. The topic matching may not be working correctly

## Recommended Fixes

### Fix 1: Lower Relevance Threshold (Immediate)
**Current**: 60/100
**Suggested**: 40-50/100 for testing

This will allow more citations to be saved while we debug why scoring is so low.

### Fix 2: Improve Scoring Error Handling
When DeepSeek scoring fails (N/A), don't automatically deny:
- Retry the scoring
- Use a fallback method
- Log the error for debugging

### Fix 3: Check DeepSeek API
- Verify API key is working
- Check rate limits
- Review scoring prompt effectiveness

### Fix 4: Fix Main Discovery Engine Error
- Check Render logs for actual error message
- The error is too generic - need specific error details
- May be network timeout, paywall, or database error

## Next Steps

1. **Check Render logs** for the actual "Candidate processing failed" error message
2. **Review DeepSeek scoring** - why are relevant citations scoring 30?
3. **Temporarily lower threshold** to 40-50 to test if citations are actually relevant
4. **Improve error logging** to get specific error messages instead of generic "failed"

