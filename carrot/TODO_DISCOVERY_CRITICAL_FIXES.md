# TODO: Critical Discovery System Fixes

**Created:** 2025-12-28  
**Status:** 🔴 CRITICAL - Discovery engine not saving/learning from discovered sources

---

## 🔴 CRITICAL PRIORITY

### 1. Fix Discovery Engine Crash
**Problem:** Engine crashed after processing just 1 frontier item (17+ hours ago)
- **Evidence:** Only 2 audit records, last activity 17+ hours ago
- **Impact:** 0/27 discovered sources saved (13 NewsAPI, 14 Anna's Archive, ~101 Wikipedia citations)
- **Action Required:**
  - [ ] Check Render logs for error around Dec 27 23:06:55 UTC
  - [ ] Identify why `frontier_pop` step is stuck in `pending`
  - [ ] Find the exception/crash that stopped the engine
  - [ ] Fix the root cause (unhandled error, blocking operation, memory issue, etc.)
  - [ ] Add error handling to prevent engine from stopping
  - [ ] Add retry logic for failed frontier items
  - [ ] Test fix with new discovery run

**Files to Check:**
- `carrot/src/lib/discovery/engineV21.ts` - `discoveryLoop()` and `processCandidate()`
- `carrot/src/lib/redis/discovery.ts` - `popFromFrontier()` function
- Render logs at 23:06:55 on Dec 27

---

### 2. Verify All Source Types Are Processed
**Problem:** Engine may not be processing all source types correctly
- **Current:** Only Wikipedia citations partially processed before crash
- **Required:** All source types must be processed:
  - [ ] Anna's Archive books (PDF extraction)
  - [ ] NewsAPI articles (content fetching)
  - [ ] Wikipedia citations (deep link extraction)

**Files to Check:**
- `carrot/src/lib/discovery/engineV21.ts` - `fetchAndExtractContent()` (lines 3589-4008)
- `carrot/src/lib/discovery/engineV21.ts` - `isAnnasArchiveUrl()` check
- Verify extraction code is being called for each source type

---

### 3. Verify Content Saving Pipeline
**Problem:** Need to ensure content is actually saved to DiscoveredContent
- **Evidence:** 0 items saved from latest run
- **Required:**
  - [ ] Verify `processCandidate()` calls `saveDiscoveredContent()` or similar
  - [ ] Check that saved content includes full text (not just metadata)
  - [ ] Verify knowledge extraction (facts, quotes, summaries) is happening
  - [ ] Test saving pipeline with sample sources

**Files to Check:**
- `carrot/src/lib/discovery/engineV21.ts` - `processCandidate()` (lines 2108-3537)
- `carrot/src/lib/discovery/engineV21.ts` - Content saving transaction (lines 3007-3151)
- `carrot/src/lib/discovery/engineV21.ts` - Knowledge extraction/synthesis

---

### 4. Verify Agent Learning Pipeline
**Problem:** Saved content must feed to agent learning
- **Required:**
  - [ ] Verify `enqueueDiscoveredContent()` is called after saving
  - [ ] Check that `AgentMemoryFeedQueue` items are created
  - [ ] Verify agent feed processor is running (cron job)
  - [ ] Test that saved content creates `AgentMemory` entries
  - [ ] Verify agent is learning from discovered content

**Files to Check:**
- `carrot/src/lib/agent/feedWorker.ts` - `enqueueDiscoveredContent()`
- `carrot/src/app/api/agent-feed/process-all/route.ts`
- `carrot/render.yaml` - Cron job configuration
- Check if feed queue items exist for saved content

---

## 🟡 HIGH PRIORITY

### 5. Investigate Why Only 1/14 Anna's Archive Books Saved (All Time)
**Problem:** Only 1 Anna's Archive book saved total, despite 14 discovered
- **Evidence:** 1 book saved with minimal text (152 chars)
- **Possible Causes:**
  - PDF extraction failing
  - Relevance filtering too strict
  - Extraction timeout
  - Content too short validation failing
- **Action:**
  - [ ] Check Anna's Archive extraction logs
  - [ ] Test PDF extraction for multiple books
  - [ ] Review relevance scoring for books
  - [ ] Check minimum content length requirements
  - [ ] Verify extraction script works in production

**Files to Check:**
- `carrot/scripts/extract-annas-archive-book.ts`
- `carrot/src/lib/discovery/engineV21.ts` - Anna's Archive extraction (lines 3617-3709)

---

### 6. Verify NewsAPI Content Extraction
**Problem:** 13 articles discovered but 0 saved from latest run
- **Action:**
  - [ ] Verify NewsAPI articles are being fetched (not just metadata)
  - [ ] Check that article content is extracted (full text, not just summary)
  - [ ] Verify articles pass relevance/quality checks
  - [ ] Test NewsAPI article extraction end-to-end

**Files to Check:**
- `carrot/src/lib/discovery/multiSourceOrchestrator.ts` - NewsAPI search
- `carrot/src/lib/discovery/engineV21.ts` - NewsAPI content extraction

---

### 7. Monitor Discovery Engine Health
**Problem:** Need better visibility into engine status
- **Action:**
  - [ ] Add health check endpoint for discovery engine
  - [ ] Add metrics/logging for frontier processing rate
  - [ ] Add alerts for stuck/failed discovery runs
  - [ ] Create dashboard for discovery run status
  - [ ] Add automatic restart for stuck runs

---

## 🟢 MEDIUM PRIORITY

### 8. Improve Error Handling and Logging
**Problem:** Engine crashes aren't properly logged/caught
- **Action:**
  - [ ] Wrap `discoveryLoop()` in try-catch
  - [ ] Add error recovery (retry, skip, continue)
  - [ ] Log all exceptions with full stack traces
  - [ ] Send errors to monitoring/alerting system
  - [ ] Add structured logging for all operations

---

### 9. Optimize Frontier Processing
**Problem:** Engine may be inefficient processing frontier items
- **Action:**
  - [ ] Review frontier priority queue logic
  - [ ] Optimize Redis operations
  - [ ] Add batching for bulk operations
  - [ ] Review scheduler guards/cooldowns
  - [ ] Test with larger frontier sizes

---

### 10. Add Discovery Run Monitoring Script
**Problem:** Need easy way to check discovery status
- **Action:**
  - [ ] Create script to monitor active discovery runs
  - [ ] Show frontier size, items processed, items saved
  - [ ] Show errors and warnings
  - [ ] Show agent learning progress
  - [ ] Add to CI/CD or scheduled monitoring

---

## 📋 IMMEDIATE NEXT STEPS

1. **Check Render Logs** (Manual - requires dashboard access)
   - Go to Render Dashboard → carrot-app → Logs
   - Look for errors around Dec 27 23:06:55 UTC
   - Search for: "Error", "Exception", "crash", "EngineV21", "frontier_pop"
   - Document the exact error message

2. **Fix the Crash**
   - Based on Render log error, fix the root cause
   - Add proper error handling
   - Test the fix

3. **Restart Discovery Run**
   - After fix, start new discovery run
   - Monitor that it processes all frontier items
   - Verify items are being saved

4. **Verify End-to-End Flow**
   - Confirm all source types are processed
   - Verify content is saved with full text
   - Verify agent learning is working
   - Check that knowledge is being extracted

---

## 🎯 Success Criteria

✅ Discovery engine processes ALL frontier items without crashing  
✅ All discovered sources (NewsAPI, Anna's Archive, Wikipedia) are processed  
✅ Content is extracted and saved to DiscoveredContent  
✅ Knowledge is extracted (facts, quotes, summaries)  
✅ Saved content feeds to agent learning pipeline  
✅ AgentMemory entries are created from discovered content  
✅ System is learning and building knowledge from discovered sources

---

**Last Updated:** 2025-12-28  
**Priority:** 🔴 CRITICAL - Discovery system is not functioning correctly

