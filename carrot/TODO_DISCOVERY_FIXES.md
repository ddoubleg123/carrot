# TODO: Discovery System Fixes

Based on comprehensive test report for Israel patch discovery.

## 🔴 Critical (Blocks Discovery)

### 1. Configure Redis
- **Issue:** REDIS_URL not set, causing discovery start to fail
- **Impact:** Frontier operations skipped, discovery cannot start properly
- **Fix:** Set REDIS_URL environment variable in deployment/config
- **Priority:** CRITICAL

### 2. Fix Anna's Archive Storage
- **Issue:** 14 books discovered but 0 saved to database
- **Impact:** Discovered sources not being persisted
- **Fix:** Investigate storage pipeline - check if discovered sources are being passed to storage layer
- **Files to check:**
  - `src/lib/discovery/planner.ts` - seedFrontierFromPlan function
  - `src/lib/discovery/multiSourceOrchestrator.ts` - how sources are returned
  - Storage/save logic for discovered content
- **Priority:** CRITICAL

### 3. Fix Agent Learning Pipeline
- **Issue:** 122 feed queue items pending, 0 new memories created
- **Impact:** Agent not learning from discovered content
- **Fix:** 
  - Check if feed queue processor is running
  - Investigate why pending items aren't being processed
  - Verify memory creation logic in feed processor
- **Files to check:**
  - Feed queue processor/worker
  - Agent memory creation logic
  - Feed queue status checks
- **Priority:** CRITICAL

## 🟡 High Priority (Major Functionality)

### 4. Configure NewsAPI
- **Issue:** NEWS_API_KEY not set, returning 0 results
- **Impact:** No news articles discovered
- **Fix:** Set NEWS_API_KEY environment variable
- **Priority:** HIGH

### 5. Fix Deep Link Processing Rate
- **Issue:** Only 47.5% of deep links processed (475/1000)
- **Impact:** Majority of Wikipedia citations not being fully processed
- **Fix:**
  - Investigate why citations are failing verification
  - Check extraction errors
  - Review processing pipeline bottlenecks
- **Files to check:**
  - Citation verification logic
  - Content extraction from citations
  - Processing queue/worker
- **Priority:** HIGH

### 6. Fix Broken Wikimedia Image URLs
- **Issue:** 30% of Wikimedia images inaccessible (7/10 working)
- **Impact:** Heroes may have broken image URLs
- **Fix:**
  - Investigate URL format issues
  - Check if images require authentication
  - Verify image URLs before saving
  - Handle moved/removed images gracefully
- **Files to check:**
  - Hero image URL processing
  - Wikimedia API/image fetching
- **Priority:** HIGH

### 7. Fix URL Canonicalization Errors
- **Issue:** `ERR_INVALID_URL` errors for relative URLs like `/IFs/frm_CountryProfile/PS`
- **Impact:** Some Wikipedia citations failing to process
- **Fix:**
  - Handle relative URLs in canonicalization
  - Resolve relative URLs against base Wikipedia URL
  - Add proper error handling for invalid URLs
- **Files to check:**
  - `src/lib/discovery/canonicalization.ts`
  - `src/lib/discovery/multiSourceOrchestrator.ts` (line 237)
- **Priority:** HIGH

## 🟢 Medium Priority (Improvements)

### 8. Save Wikipedia Pages as Discovered Content
- **Issue:** Wikipedia pages monitored but not saved as discovered content
- **Impact:** Missing Wikipedia page content in discovered content
- **Fix:** Ensure Wikipedia pages are saved along with citations
- **Priority:** MEDIUM

### 9. Configure DeepSeek API
- **Issue:** Using mock responses, may affect search strategy quality
- **Impact:** Search strategy may not be optimal
- **Fix:** Set DEEPSEEK_API_KEY or configure local router at localhost:8080
- **Priority:** MEDIUM

### 10. Review Relevance Filtering Thresholds
- **Issue:** 76% of sources filtered out - may be too aggressive
- **Impact:** Potentially relevant sources being filtered
- **Fix:** Review and tune relevance thresholds
- **Files to check:**
  - `src/lib/discovery/relevanceEngine.ts`
  - Relevance scoring logic
- **Priority:** MEDIUM

### 11. Add Error Handling for Canonicalization
- **Issue:** Canonicalization errors break processing flow
- **Impact:** One bad URL can stop processing
- **Fix:** Wrap canonicalization in try-catch, log errors, continue processing
- **Priority:** MEDIUM

## 🔵 Low Priority (Optimization)

### 12. Optimize Test Script Performance
- **Issue:** Test script times out when capturing full output
- **Impact:** Hard to get full test results
- **Fix:**
  - Add progress logging
  - Break into smaller test phases
  - Stream output instead of buffering
- **Priority:** LOW

### 13. Review Memory Optimizations
- **Issue:** Verify memory optimizations are working correctly
- **Impact:** Ensure memory usage is controlled
- **Fix:** Review and test memory optimizations in multiSourceOrchestrator
- **Priority:** LOW

### 14. Set Up Monitoring/Alerting
- **Issue:** No monitoring for discovery runs
- **Impact:** Issues may go unnoticed
- **Fix:** Add monitoring for:
  - Discovery run success rates
  - Processing times
  - Error rates
  - Queue depths
- **Priority:** LOW

---

## 📋 Implementation Checklist

- [ ] Set REDIS_URL environment variable
- [ ] Set NEWS_API_KEY environment variable  
- [ ] Set DEEPSEEK_API_KEY or configure local router
- [ ] Fix Anna's Archive storage pipeline
- [ ] Fix agent feed queue processing
- [ ] Investigate deep link processing failures
- [ ] Fix Wikimedia image URL handling
- [ ] Fix URL canonicalization for relative URLs
- [ ] Add error handling for canonicalization
- [ ] Ensure feed queue processor is running
- [ ] Review relevance filtering thresholds
- [ ] Save Wikipedia pages as discovered content
- [ ] Optimize test script
- [ ] Set up monitoring/alerting

---

## 🔍 Files to Investigate

1. **Storage Issues:**
   - `src/lib/discovery/planner.ts` - seedFrontierFromPlan
   - Storage/save functions for discovered content
   - Anna's Archive integration points

2. **Agent Learning:**
   - Feed queue processor/worker files
   - Agent memory creation logic
   - Feed queue processing endpoints

3. **URL Processing:**
   - `src/lib/discovery/canonicalization.ts` - URL canonicalization
   - `src/lib/discovery/multiSourceOrchestrator.ts` - Citation processing

4. **Image Handling:**
   - Hero image URL processing
   - Wikimedia image fetching logic

5. **Configuration:**
   - `.env` files
   - Deployment configuration
   - Environment variable setup

---

## 📊 Success Metrics

After fixes, we should see:
- ✅ 100% of discovered Anna's Archive sources saved
- ✅ Agent memories increasing from discovered content
- ✅ >80% deep link processing rate
- ✅ >90% Wikimedia image success rate
- ✅ No canonicalization errors in logs
- ✅ News articles being discovered (if API key set)
- ✅ Discovery runs completing successfully

---

**Last Updated:** December 27, 2025  
**Based on:** Comprehensive Discovery Test Report - Israel Patch

