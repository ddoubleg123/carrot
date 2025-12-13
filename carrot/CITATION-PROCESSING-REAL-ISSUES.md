# Citation Processing - Real Issues Found

## 🔍 Critical Issues Discovered

### 1. DeepSeek API Not Configured ⚠️ **CRITICAL**

**Problem:**
- All citations are getting default score of 50
- DeepSeek API calls are failing: `DEEPSEEK_API_KEY exists: false`
- Using mock stream instead of real API
- All citations are being rejected because score = 50 with `isRelevant: false`

**Evidence:**
```
[DeepSeek] DEEPSEEK_API_KEY exists: false
[DeepSeek] Using mock stream
[WikipediaProcessor] DeepSeek content scoring: {
  score: 50,
  isRelevant: false,
  reason: 'Scoring failed - default score'
}
```

**Impact:**
- **ALL citations are being denied** because they can't get real AI scores
- The new lenient relevance check can't work without real API calls
- We're processing citations but they all fail due to missing API key

**Fix Required:**
1. Set `DEEPSEEK_API_KEY` environment variable
2. Verify API is accessible from the processing environment
3. Test with a few citations to ensure scoring works

### 2. Only 219 Denied Citations Found (Should Be More)

**Current State:**
- Total citations: 8,839
- Scanned: 3,795 (43%)
- Saved: 1,357 (15%)
- Denied: 219 (found by script)

**Discrepancy:**
- If 3,795 were scanned and 1,357 were saved, that means ~2,438 should be denied
- But script only found 219 denied citations
- This suggests:
  - Many citations failed verification (never scanned)
  - Many are marked as "pending_wiki" (Wikipedia internal links)
  - Some may have other statuses

**What We Need:**
- Check ALL citations, not just denied ones
- Find citations that failed verification
- Reprocess everything with proper API configuration

### 3. Processing Script Issues

**Problems:**
1. Script only processes citations with `relevanceDecision: null`
2. But ALL citations already have a decision (saved or denied)
3. Audit system only finds a few high-score denied citations
4. Need to explicitly reset denied citations first

**Current Flow:**
1. `getNextCitationToProcess` looks for `relevanceDecision: null`
2. Finds nothing because all citations have decisions
3. Falls back to audit system which finds ~8 citations
4. Processes those, but they fail due to missing API key

**Required Flow:**
1. Reset ALL denied citations (or at least high-score ones)
2. Ensure DeepSeek API is configured
3. Process with new lenient relevance check
4. Should save many more citations

## ✅ Solutions

### Step 1: Fix DeepSeek API Configuration

**Check if API key is set:**
```bash
# In production/deployment environment
echo $DEEPSEEK_API_KEY
```

**Set API key if missing:**
```bash
export DEEPSEEK_API_KEY=your_key_here
```

**Or in .env file:**
```
DEEPSEEK_API_KEY=your_key_here
```

### Step 2: Reprocess ALL Denied Citations

**Reset denied citations:**
```bash
# Reset all denied citations (or start with high-score ones)
ts-node scripts/reprocess-all-denied-citations.ts --patch=israel --min-score=70

# Or reset ALL denied citations
ts-node scripts/reprocess-all-denied-citations.ts --patch=israel --min-score=0
```

**Then process them:**
```bash
ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10
```

### Step 3: Check Unprocessed Citations

**Find citations that haven't been scanned:**
```sql
SELECT COUNT(*) 
FROM wikipedia_citations 
WHERE scan_status = 'not_scanned' 
AND verification_status IN ('pending', 'verified')
```

**These need to be processed too!**

## 📊 Expected Results After Fixes

### With DeepSeek API Working:

1. **Real AI Scores**
   - Citations will get actual relevance scores (0-100)
   - High scores (>= 70) will be saved automatically
   - Scores 50-69 with `isRelevant: true` will be saved

2. **More Citations Saved**
   - Currently: 1,357 saved (15%)
   - Expected: 2,000-3,000 saved (25-35%)
   - High-score denied citations will be reprocessed and saved

3. **Better Quality**
   - Real AI evaluation instead of default scores
   - More accurate relevance decisions
   - Better content selection

## 🚨 Action Items

1. **URGENT: Configure DeepSeek API**
   - Without this, NO citations can be properly evaluated
   - All citations will default to score 50 and be rejected

2. **Reset Denied Citations**
   - Start with high-score ones (>= 70): ~8 citations
   - Then medium-score ones (50-69): ~8 citations  
   - Then all denied: 219 citations

3. **Process in Batches**
   - Start small: 10-20 citations to test
   - Verify API is working and citations are being saved
   - Then scale up to process all

4. **Monitor Results**
   - Check how many citations are saved
   - Verify savedContentId is being set
   - Ensure quality is maintained

## 📝 Summary

**The real problem is NOT the relevance check logic - it's that:**
1. DeepSeek API is not configured, so all citations get default scores
2. We haven't reprocessed the denied citations with the new lenient check
3. We need to reset denied citations before processing them

**Once DeepSeek API is configured and we reprocess denied citations, we should see:**
- Many more citations saved
- Better quality decisions
- Proper use of the new lenient relevance check

