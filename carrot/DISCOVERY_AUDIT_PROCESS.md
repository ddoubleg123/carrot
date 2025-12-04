# Discovery Process Audit Guide

This guide provides a step-by-step process to audit and debug the discovery pipeline when things go wrong.

## Quick Health Check

Run this first to get an overview:

```bash
cd carrot
npx tsx scripts/check-zionism-references.ts --patch=israel --wiki-title=Zionism
```

## Step-by-Step Audit Process

### Step 1: Verify Database State

**Check Wikipedia Pages in Monitoring:**
```bash
npx tsx scripts/check-seed-candidates.ts --patch=israel
```

**Expected:** Should show 10-20 Wikipedia pages in monitoring.

**If issues:** Check if pages are stuck in `scanning` or `error` state.

---

### Step 2: Check Citation Extraction

**Check Citations Extracted:**
```sql
-- Run in your database client
SELECT 
  wm.wikipediaTitle,
  COUNT(wc.id) as total_citations,
  COUNT(CASE WHEN wc.verificationStatus = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN wc.verificationStatus = 'verified' THEN 1 END) as verified,
  COUNT(CASE WHEN wc.verificationStatus = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN wc.scanStatus = 'not_scanned' THEN 1 END) as not_scanned,
  COUNT(CASE WHEN wc.scanStatus = 'scanned' THEN 1 END) as scanned,
  COUNT(CASE WHEN wc.scanStatus = 'scanned_denied' THEN 1 END) as scanned_denied,
  COUNT(CASE WHEN wc.relevanceDecision = 'saved' THEN 1 END) as saved,
  COUNT(CASE WHEN wc.relevanceDecision = 'denied' THEN 1 END) as denied
FROM "WikipediaMonitoring" wm
LEFT JOIN "WikipediaCitation" wc ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
GROUP BY wm.id, wm.wikipediaTitle
ORDER BY total_citations DESC;
```

**Expected:** 
- Total citations should match Wikipedia page references
- Most should be `not_scanned` initially
- `scanned_denied` should only appear for verification failures

---

### Step 3: Check Processing Queue

**Check Next Citation to Process:**
```bash
npx tsx scripts/show-next-external-urls.ts --patch=israel
```

**Expected:** Should show citations with `verificationStatus: 'pending'` and `scanStatus: 'not_scanned'`.

**If empty:** Check if all citations are stuck in `scanned_denied` or have `relevanceDecision` set.

---

### Step 4: Check Verification Status

**Check Verification Failures:**
```sql
SELECT 
  wc."citationUrl",
  wc."verificationStatus",
  wc."errorMessage",
  wc."scanStatus",
  wc."relevanceDecision"
FROM "WikipediaCitation" wc
JOIN "WikipediaMonitoring" wm ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
  AND wc."verificationStatus" = 'failed'
LIMIT 20;
```

**Expected:**
- `scanStatus` should be `scanned_denied` for failed verifications
- `relevanceDecision` should be `denied_verify`
- `errorMessage` should explain why (403, timeout, etc.)

**If issues:**
- Check if HEAD requests are failing (should fallback to GET)
- Check if rate limiting is too aggressive
- Check if User-Agent headers are being sent

---

### Step 5: Check Content Extraction

**Check Citations with Content:**
```sql
SELECT 
  wc."citationUrl",
  LENGTH(wc."contentText") as content_length,
  wc."aiPriorityScore",
  wc."relevanceDecision",
  wc."savedContentId"
FROM "WikipediaCitation" wc
JOIN "WikipediaMonitoring" wm ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
  AND wc."contentText" IS NOT NULL
  AND LENGTH(wc."contentText") > 0
ORDER BY content_length DESC
LIMIT 20;
```

**Expected:**
- Content length should be > 500 characters for most
- Citations with content should have `aiPriorityScore` set
- `savedContentId` should be set if `relevanceDecision = 'saved'`

**If issues:**
- Check logs for `content_extract` entries
- Verify extraction method (readability, content-extractor, fallback)
- Check if content is too short (< 500 chars)

---

### Step 6: Check AI Scoring

**Check Scoring Results:**
```sql
SELECT 
  wc."citationUrl",
  wc."aiPriorityScore",
  wc."relevanceDecision",
  CASE 
    WHEN wc."aiPriorityScore" >= 60 THEN 'above_threshold'
    WHEN wc."aiPriorityScore" IS NULL THEN 'not_scored'
    ELSE 'below_threshold'
  END as score_status
FROM "WikipediaCitation" wc
JOIN "WikipediaMonitoring" wm ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
  AND wc."scanStatus" = 'scanned'
ORDER BY wc."aiPriorityScore" DESC NULLS LAST
LIMIT 20;
```

**Expected:**
- Citations with score >= 60 should have `relevanceDecision = 'saved'`
- Citations with score < 60 should have `relevanceDecision = 'denied'`
- No null scores for scanned citations

**If issues:**
- Check logs for `ai_score` entries
- Verify DeepSeek API is responding
- Check if content is too short (< 600 chars) for AI scoring

---

### Step 7: Check Saved Content

**Check DiscoveredContent:**
```sql
SELECT 
  dc.title,
  dc."sourceUrl",
  dc."relevanceScore",
  LENGTH(dc.content) as content_length,
  dc."qualityScore"
FROM "DiscoveredContent" dc
WHERE dc."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
ORDER BY dc."createdAt" DESC
LIMIT 20;
```

**Expected:**
- Content should have meaningful titles
- `relevanceScore` should be >= 0.6 (60/100)
- Content length should be > 800 characters

**If empty:**
- Check if citations are being scored but not saved
- Check if `saveAsContent` function is being called
- Check logs for `content_saved` entries

---

### Step 8: Check Processing Metrics

**Check Logs for Metrics:**
Look for `processing_metrics` log entries in your logs:

```json
{
  "tag": "processing_metrics",
  "metrics": {
    "totalProcessed": 50,
    "extractionRate": "90.0%",
    "minLen500Rate": "60.0%",
    "isArticleRate": "40.0%",
    "saveRate": "20.0%",
    "savedWithScore60Plus": 10
  }
}
```

**Expected SLOs:**
- ≥90% reach extraction
- ≥60% pass min-len 500
- ≥40% pass isArticle
- ≥20% reach save with score ≥60

**If below targets:**
- Check which gate is failing (extraction, validation, scoring, saving)
- Review structured logs for each gate

---

### Step 9: Check Structured Logs

**Key Log Tags to Monitor:**

1. **`verify_fail`** - Verification failures
   ```json
   {"tag": "verify_fail", "url": "...", "status": 403, "method": "HEAD"}
   ```

2. **`content_extract`** - Content extraction
   ```json
   {"tag": "content_extract", "url": "...", "method": "readability", "textBytes": 5000, "paragraphCount": 10}
   ```

3. **`content_validate_fail`** - Validation failures
   ```json
   {"tag": "content_validate_fail", "url": "...", "reason": "min_len_500", "textBytes": 300}
   ```

4. **`ai_score`** - AI scoring results
   ```json
   {"tag": "ai_score", "url": "...", "score": 75, "threshold": 60, "isRelevant": true}
   ```

5. **`content_saved`** - Successful saves
   ```json
   {"tag": "content_saved", "url": "...", "textBytes": 5000, "score": 75, "hero": true}
   ```

**If missing logs:**
- Check if processing is actually running
- Check if logs are being filtered
- Verify structured logging is enabled

---

### Step 10: Check Rate Limiting & Idempotency

**Check for Duplicate Processing:**
```sql
SELECT 
  wc."citationUrl",
  COUNT(*) as processing_count,
  MAX(wc."updatedAt") as last_updated
FROM "WikipediaCitation" wc
JOIN "WikipediaMonitoring" wm ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
GROUP BY wc."citationUrl"
HAVING COUNT(*) > 1
ORDER BY processing_count DESC;
```

**Expected:** No duplicates (each URL should appear once)

**If duplicates found:**
- Check if idempotency keys are working
- Check if rate limiting is preventing processing
- Check logs for "already being processed" messages

---

### Step 11: Run Self-Audit

**Run Self-Audit Function:**
```bash
curl -X POST http://localhost:3000/api/test/extraction/audit \
  -H "Content-Type: application/json" \
  -d '{"patchHandle": "israel", "wikipediaTitle": "Zionism"}'
```

**Expected Response:**
```json
{
  "wikipediaPage": "Zionism",
  "totalExternalUrls": 1236,
  "foundInDatabase": 1236,
  "missingFromDatabase": 0,
  "statusBreakdown": {
    "pending": 100,
    "verified": 800,
    "failed": 50,
    "saved": 200,
    "denied": 86
  },
  "missingUrls": [],
  "discrepancies": []
}
```

**If issues:**
- Missing URLs indicate extraction problems
- Discrepancies indicate status mismatches
- Review the breakdown to see where citations are stuck

---

### Step 12: Check Backfill Status

**Check Citations Eligible for Backfill:**
```sql
SELECT 
  COUNT(*) as eligible_count,
  COUNT(CASE WHEN wc."scanStatus" = 'not_scanned' THEN 1 END) as not_scanned,
  COUNT(CASE WHEN wc."scanStatus" = 'scanned_denied' THEN 1 END) as scanned_denied
FROM "WikipediaCitation" wc
JOIN "WikipediaMonitoring" wm ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
  AND wc."scanStatus" IN ('not_scanned', 'scanned_denied')
  AND wc."updatedAt" > NOW() - INTERVAL '7 days';
```

**If eligible citations exist:**
```bash
npx tsx scripts/backfill-failed-citations.ts israel 7 5 500
```

---

## Common Issues & Solutions

### Issue: "No citations available to process"

**Causes:**
1. All citations are `scanned_denied` (verification failures)
2. All citations have `relevanceDecision` set
3. Query is too restrictive

**Solution:**
- Check `getNextCitationToProcess` query
- Review verification failures
- Run backfill script

---

### Issue: "All citations failing verification"

**Causes:**
1. HEAD requests being blocked (403)
2. Rate limiting too aggressive
3. User-Agent headers missing

**Solution:**
- Check logs for `verify_fail` entries
- Verify HEAD→GET fallback is working
- Check rate limit settings
- Review `FORCE_GET_DOMAINS` list

---

### Issue: "Content extraction producing short text"

**Causes:**
1. Readability failing
2. ContentExtractor failing
3. Fallback producing poor results

**Solution:**
- Check logs for `content_extract` entries
- Verify extraction method being used
- Check if HTML is valid
- Review content length distribution

---

### Issue: "AI scoring not happening"

**Causes:**
1. Content too short (< 600 chars)
2. DeepSeek API failing
3. Rate limiting on AI calls

**Solution:**
- Check logs for `ai_score` entries
- Verify content length
- Check DeepSeek API status
- Review error messages

---

### Issue: "Citations scored but not saved"

**Causes:**
1. Score below threshold (60)
2. `saveAsContent` function not provided
3. Database errors

**Solution:**
- Check `aiPriorityScore` values
- Verify `saveAsContent` is being called
- Check database logs for errors
- Review `content_saved` logs

---

## Quick Diagnostic Script

Run this to get a full diagnostic report:

```bash
npx tsx scripts/diagnose-discovery.ts --patch=israel
```

(Note: This script needs to be created - it would combine all the above checks)

---

## Next Steps After Audit

1. **If verification failing:** Review HEAD→GET fallback, check rate limits
2. **If extraction failing:** Review content extraction chain, check HTML quality
3. **If scoring failing:** Review AI scoring logic, check content length
4. **If saving failing:** Review save logic, check database constraints
5. **If metrics below SLOs:** Review each gate, check logs for bottlenecks

---

## Emergency Fixes

### Reset Stuck Citations

```sql
-- Reset citations stuck in scanning state
UPDATE "WikipediaCitation"
SET "scanStatus" = 'not_scanned'
WHERE "scanStatus" = 'scanning'
  AND "updatedAt" < NOW() - INTERVAL '1 hour';
```

### Reprocess Failed Citations

```bash
npx tsx scripts/backfill-failed-citations.ts israel 30 5 1000
```

### Clear Rate Limit Cache

(If using in-memory rate limiting, restart the service)

---

## Monitoring Dashboard Queries

**Real-time Processing Status:**
```sql
SELECT 
  wm.wikipediaTitle,
  COUNT(*) as total,
  COUNT(CASE WHEN wc."scanStatus" = 'not_scanned' THEN 1 END) as pending,
  COUNT(CASE WHEN wc."scanStatus" = 'scanning' THEN 1 END) as processing,
  COUNT(CASE WHEN wc."relevanceDecision" = 'saved' THEN 1 END) as saved
FROM "WikipediaMonitoring" wm
LEFT JOIN "WikipediaCitation" wc ON wc."monitoringId" = wm.id
WHERE wm."patchId" = (SELECT id FROM "Patch" WHERE handle = 'israel')
GROUP BY wm.id, wm.wikipediaTitle
ORDER BY pending DESC;
```

---

## Contact Points

- **Logs:** Check Render logs or local console
- **Database:** Use Prisma Studio or direct SQL
- **API:** Use `/api/test/extraction` endpoint
- **Scripts:** Use diagnostic scripts in `scripts/` folder

