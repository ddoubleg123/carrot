# Discovery Citation Processing - Audit & Test Plan

## Overview

We need to verify that the discovery process is properly:
1. ✅ **Extracting content** from citation URLs
2. ✅ **Scoring citations** with DeepSeek API (not default scores)
3. ✅ **Saving relevant citations** to DiscoveredContent
4. ✅ **Processing at scale** (8,839 citations for Israel patch)

## Current Status

### DeepSeek API Configuration ✅
- **API Key:** `sk-3e70cb84bec643e693c2f5654142d66` (configured in Render)
- **Status:** Key is visible in environment variables
- **Next:** Verify it's actually working in the application

### Citation Statistics
- **Total citations:** 8,839
- **Scanned:** 3,795 (43%)
- **Saved:** 1,357 (15%)
- **Denied:** ~2,438 (28%)
- **Unprocessed:** ~5,044 (57%)

### Known Issues (Fixed)
- ✅ 30-day requirement removed
- ✅ Citation audit system implemented
- ✅ More lenient relevance check (score >= 70 auto-saves)
- ⚠️ **Need to verify:** DeepSeek API is actually working

---

## The Plan

### Phase 1: Verify DeepSeek API ✅

**Script:** `scripts/verify-deepseek-api.ts`

**What it does:**
- Checks if `DEEPSEEK_API_KEY` is set
- Makes a test API call
- Verifies response format
- Tests scoring functionality

**Run:**
```bash
npx tsx scripts/verify-deepseek-api.ts
```

**Expected Result:**
- ✅ API key is configured
- ✅ API call succeeds
- ✅ Gets real score (not default 50)
- ✅ Response format is valid

**If it fails:**
- Check environment variable is set correctly
- Verify API key is valid
- Check network connectivity

---

### Phase 2: Audit Discovery Processing 🔍

**Script:** `scripts/audit-discovery-citation-processing.ts`

**What it does:**
- Processes citations in audit mode
- Tracks detailed metrics at each step:
  - URL verification
  - Content extraction
  - AI scoring
  - Save/deny decisions
- Generates detailed report

**Run:**
```bash
# Start with small batch to test
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=20 \
  --verbose

# Then larger audit
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=100 \
  --batch-size=10
```

**What to Measure:**

1. **Content Extraction Success Rate**
   - How many citations successfully extract content?
   - Average content length?
   - Extraction methods used?

2. **AI Scoring Quality**
   - Are we getting real scores (not all 50s)?
   - Score distribution (high/medium/low)?
   - Average score?

3. **Save Rate**
   - How many citations are being saved?
   - What's the save rate? (target: 15-35%)
   - Why are citations being denied?

4. **Error Tracking**
   - What errors are occurring?
   - At which step do failures happen?
   - Are there patterns?

**Expected Results:**
- ✅ Content extracted from 80%+ of citations
- ✅ Real AI scores (not all 50s)
- ✅ Save rate: 15-35%
- ✅ High scores (>=70) are being saved
- ✅ Detailed metrics in report

---

### Phase 3: Analyze Results 📊

**Review the audit report:**
- Location: `reports/discovery-audit-israel-<timestamp>.json`

**Key Metrics to Check:**

1. **Save Rate**
   ```
   Target: 15-35%
   Current: 15%
   If < 10%: Problem with API or relevance check
   ```

2. **AI Scoring**
   ```
   Should see distribution:
   - High (>=70): 10-20%
   - Medium (60-69): 20-30%
   - Low (<60): 50-70%
   
   If all scores = 50: API not working
   ```

3. **Content Extraction**
   ```
   Success rate: Should be 80%+
   Average length: 1,000-5,000 chars
   If < 500 chars: Extraction failing
   ```

4. **Errors**
   ```
   Should be minimal (< 5%)
   If high error rate: Check specific error types
   ```

---

### Phase 4: Fix Issues (If Needed) 🔧

**If API is not working:**
1. Verify `DEEPSEEK_API_KEY` in Render dashboard
2. Check API key is valid
3. Test API directly
4. Re-run verification script

**If save rate is too low:**
1. Review denied citations
2. Check if scores are real (not 50s)
3. Adjust relevance thresholds if needed
4. Review content extraction quality

**If content extraction is failing:**
1. Check extraction methods
2. Review rate limiting
3. Verify URLs are accessible
4. Check for blocking/403 errors

---

## What is "Reprocessing Pipeline"?

The **reprocessing pipeline** refers to the system that:

1. **Identifies citations that should be reprocessed**
   - High-score denied citations (audit system)
   - Citations with failed saves
   - Citations that need re-evaluation

2. **Resets citation status**
   - Clears `relevanceDecision`
   - Resets `scanStatus`
   - Allows re-processing

3. **Processes citations again**
   - Re-verifies URLs
   - Re-extracts content
   - Re-scores with AI
   - Makes new save/deny decision

**Scripts for reprocessing:**
- `scripts/reprocess-all-denied-citations.ts` - Reset denied citations
- `scripts/reprocess-denied-high-score-citations.ts` - Reset high-score denied
- `scripts/process-all-citations.ts` - Process citations in batches

**When to use:**
- After fixing bugs in scoring logic
- After configuring DeepSeek API
- After adjusting relevance thresholds
- When citations were incorrectly denied

---

## Success Criteria

### ✅ API Verification
- [ ] API key is configured
- [ ] API calls succeed
- [ ] Real scores returned (not 50s)
- [ ] Response format valid

### ✅ Content Extraction
- [ ] 80%+ citations extract content
- [ ] Average content length > 1,000 chars
- [ ] Multiple extraction methods working
- [ ] Low error rate (< 5%)

### ✅ AI Scoring
- [ ] Real scores (not all 50s)
- [ ] Score distribution: high/medium/low
- [ ] High scores (>=70) exist
- [ ] Average score reasonable (50-70)

### ✅ Save Rate
- [ ] Save rate: 15-35%
- [ ] High-score citations saved
- [ ] Denied citations have low scores
- [ ] Quality maintained

### ✅ Processing Pipeline
- [ ] Citations processed in batches
- [ ] No infinite loops
- [ ] Errors handled gracefully
- [ ] Progress tracked

---

## Next Steps

1. **Run API verification** - Confirm DeepSeek is working
2. **Run discovery audit** - Measure actual performance
3. **Analyze results** - Identify issues
4. **Fix issues** - Address problems found
5. **Re-run audit** - Verify fixes work
6. **Scale up** - Process all 8,839 citations

---

## Commands Summary

```bash
# 1. Verify API
npx tsx scripts/verify-deepseek-api.ts

# 2. Run audit (small test)
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=20 \
  --verbose

# 3. Run audit (larger)
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=100

# 4. Check results
cat reports/discovery-audit-israel-*.json | jq .

# 5. If needed: Reset and reprocess
npx tsx scripts/reprocess-all-denied-citations.ts --patch=israel --min-score=0
npx tsx scripts/process-all-citations.ts --patch=israel --batch-size=10
```

---

## Questions to Answer

After running the audit, we should know:

1. ✅ **Is DeepSeek API working?** (verify script)
2. ✅ **Are we extracting content?** (audit report)
3. ✅ **Are we getting real scores?** (audit report)
4. ✅ **What's our actual save rate?** (audit report)
5. ✅ **Why are citations being denied?** (audit report)
6. ✅ **Are we properly scraping all data?** (content extraction stats)

This will tell us exactly what's working and what needs to be fixed!

