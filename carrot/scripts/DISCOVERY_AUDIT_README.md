# Discovery Citation Processing Audit Scripts

## Overview

These scripts help you verify and audit the discovery process to ensure citations are being properly processed, content is being extracted, and citations are being saved correctly.

## Scripts

### 1. `verify-deepseek-api.ts`

**Purpose:** Verifies that the DeepSeek API is configured and working correctly.

**What it tests:**
- ✅ API key is configured
- ✅ API is accessible
- ✅ Scoring works correctly
- ✅ Response format is valid

**Usage:**
```bash
npx tsx scripts/verify-deepseek-api.ts
```

**Expected Output:**
```
🔍 Verifying DeepSeek API Configuration...

✅ DEEPSEEK_API_KEY is configured
   Key: sk-3e70cb84...d66

🧪 Testing DeepSeek API call...
✅ API call succeeded
   Response time: 1234ms
   Score: 85
   Is Relevant: true
   Is Article: true
   Quality: high
   Reason: This article is directly about Israel...

✅ DeepSeek API Verification Complete
```

**If API is not configured:**
```
❌ DEEPSEEK_API_KEY is not set in environment variables

To fix:
1. Add DEEPSEEK_API_KEY to your .env file
2. Or set it in Render dashboard: Environment > DEEPSEEK_API_KEY
```

---

### 2. `audit-discovery-citation-processing.ts`

**Purpose:** Runs discovery in audit mode to track detailed metrics on citation processing.

**What it measures:**
- 📊 How many citations are being processed
- 📄 How many are extracting content successfully
- 💾 How many are being saved
- 📏 Content extraction quality (lengths, methods)
- 🎯 AI scoring success rate and distribution
- ❌ Errors and failure points

**Usage:**
```bash
# Basic usage (default: 50 citations, israel patch)
npx tsx scripts/audit-discovery-citation-processing.ts

# With options
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=100 \
  --batch-size=10 \
  --verbose
```

**Options:**
- `--patch=<handle>` - Patch to audit (default: `israel`)
- `--limit=<number>` - Number of citations to process (default: `50`)
- `--batch-size=<number>` - Citations per batch (default: `10`)
- `--verbose` or `-v` - Show detailed output for each citation

**Expected Output:**
```
🔍 Discovery Citation Processing Audit

Patch: israel
Limit: 50 citations
Batch size: 10

✅ Found patch: Israel (cmip4pwb40001rt1t7a13p27g)

📊 Initial Citation Statistics:
[...]

🚀 Starting citation processing audit...

📦 Processing batch 1 (10 citations)...
   Processing 10/50...

📊 Final Audit Results:

📈 Processing Metrics:
   Total Processed: 50
   Newly Scanned: 45
   Newly Saved: 12
   Newly Denied: 33
   Save Rate: 26.7%

📄 Content Extraction:
   Citations with Content: 45
   Average Length: 3,245 chars
   Min Length: 600 chars
   Max Length: 15,432 chars

🎯 AI Scoring:
   Citations with Scores: 45
   Average Score: 58.3
   Min Score: 30
   Max Score: 95
   High (>=70): 8
   Medium (60-69): 12
   Low (<60): 25

💾 DiscoveredContent Created:
   Total Saved: 12

📄 Audit report saved: reports/discovery-audit-israel-1234567890.json

✅ Audit complete!
```

**Report File:**
The script generates a detailed JSON report in `reports/discovery-audit-<patch>-<timestamp>.json` with:
- Processing metrics
- Content extraction stats
- AI scoring distribution
- Error details
- Timestamp and patch info

---

## Workflow

### Step 1: Verify API is Working
```bash
npx tsx scripts/verify-deepseek-api.ts
```

**If this fails:**
- Check that `DEEPSEEK_API_KEY` is set in your environment
- Verify the API key is valid
- Check network connectivity

### Step 2: Run Discovery Audit
```bash
# Start with a small batch to test
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=20 \
  --verbose

# Then run a larger audit
npx tsx scripts/audit-discovery-citation-processing.ts \
  --patch=israel \
  --limit=100 \
  --batch-size=10
```

### Step 3: Analyze Results

**Key Metrics to Check:**
1. **Save Rate** - Should be 15-35% (currently 15%)
2. **Content Extraction** - Should extract content from most citations
3. **AI Scoring** - Should get real scores (not all 50s)
4. **High Scores** - Should have citations scoring 70+

**Red Flags:**
- ❌ Save rate < 10% - API might not be working
- ❌ All scores = 50 - API not configured
- ❌ No content extracted - Content extraction failing
- ❌ Many errors - Processing pipeline issues

---

## Troubleshooting

### API Verification Fails

**Problem:** `DEEPSEEK_API_KEY is not set`

**Solution:**
1. Check `.env` file has `DEEPSEEK_API_KEY=sk-...`
2. Or set in Render: Environment > DEEPSEEK_API_KEY
3. Restart the service after setting

**Problem:** `API call failed: Network error`

**Solution:**
- Check network connectivity
- Verify API key is valid
- Check if DeepSeek API is down
- Check rate limits

### Audit Shows Low Save Rate

**Problem:** Save rate < 10%

**Possible Causes:**
1. API not working (all scores = 50)
2. Relevance threshold too strict
3. Content extraction failing
4. Citations genuinely not relevant

**Debug Steps:**
1. Check if API is working: `verify-deepseek-api.ts`
2. Check score distribution in audit report
3. Check content extraction stats
4. Review denied citations manually

### No Citations Available

**Problem:** `No more citations available to process`

**Possible Causes:**
1. All citations already processed
2. Citations need to be reset
3. No citations in database for this patch

**Solution:**
```bash
# Check citation status
npx tsx scripts/check-citation-status.ts --patch=israel

# Reset denied citations if needed
npx tsx scripts/reprocess-all-denied-citations.ts --patch=israel --min-score=0
```

---

## Integration with Discovery Process

These audit scripts are designed to work alongside the normal discovery process:

1. **Run audit before major discovery runs** - Verify API is working
2. **Run audit during discovery** - Monitor processing quality
3. **Run audit after discovery** - Measure results and identify issues

The audit scripts use the same processing functions as the real discovery process, so they give accurate metrics on what's actually happening.

---

## Next Steps

After running the audit:

1. **If API is working and save rate is good:**
   - Continue with normal discovery
   - Monitor metrics periodically

2. **If API is working but save rate is low:**
   - Review denied citations
   - Adjust relevance thresholds if needed
   - Check content extraction quality

3. **If API is not working:**
   - Fix API configuration
   - Re-run verification
   - Re-run audit

4. **If content extraction is failing:**
   - Review extraction methods
   - Check for rate limiting
   - Verify URLs are accessible

