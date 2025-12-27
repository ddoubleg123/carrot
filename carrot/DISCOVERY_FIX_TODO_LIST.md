# Discovery Fix Todo List
## Based on Audit Findings - December 27, 2025

### Critical Issues (Fix First)

#### 1. Fix Wikipedia Deep Link Extraction ❌
**Issue**: Zero outlinks and internal links extracted from Wikipedia pages
- **Current State**: 0 outlinks, 0 internal links, only citations extracted
- **Expected**: Extract outlinks to external sites and internal Wikipedia links for deeper crawling
- **Actions**:
  - Verify `enqueueWikipediaReferences()` is being called when Wikipedia pages are processed
  - Verify `enqueueInternalWikipediaLinks()` is being called
  - Verify `enqueueHtmlOutgoingReferences()` is being called
  - Check if Wikipedia pages are actually being fetched (not just citations)
  - Add logging to track when these functions are called and how many links are extracted
  - Verify that `DEEP_LINK_SCRAPER` flag is enabled
  - Check if Wikipedia pages trigger the deep link extraction code path in `processCandidate()`

#### 2. Fix News Source Extraction ❌
**Issue**: Zero news items processed
- **Current State**: 0 news items processed, 0 saved
- **Expected**: News articles should be discovered, processed, and saved
- **Actions**:
  - Verify NewsAPI integration in `multiSourceOrchestrator.ts` is working
  - Check if `searchNewsAPI()` is being called during discovery
  - Verify news URLs are being added to frontier
  - Check if news search queries are being executed during planning
  - Verify news sources are included in `primarySources` during plan generation
  - Add logging to track news search execution and results

#### 3. Fix Processing Stall ⚠️
**Issue**: No activity in last 10+ hours despite 1,720 pending citations
- **Current State**: Last processed 10+ hours ago, 0 citations/hour processing rate
- **Expected**: Continuous processing of pending citations
- **Actions**:
  - Investigate why discovery loop stopped processing
  - Check if runs are actually running or stuck
  - Verify frontier is being populated from pending citations
  - Check if frontier items are being dequeued properly
  - Verify `pullCandidateWithBias()` is returning candidates
  - Check if scheduler guards are blocking all candidates
  - Verify run state is actually "live" and not paused/suspended

#### 4. Fix Stuck Discovery Runs ⚠️
**Issue**: 5 runs stuck in "live" status (oldest 2 days old)
- **Current State**: All runs have null metrics, no recent activity
- **Expected**: Runs should complete or be marked as suspended/completed
- **Actions**:
  - Implement run cleanup to mark old inactive runs as "suspended" or "completed"
  - Add run health check to detect stuck runs (no activity for X hours)
  - Add timeout mechanism to auto-suspend runs after inactivity
  - Add logging to track run state changes and activity
  - Verify `ensureLiveState()` is properly checking run state
  - Check if runs are actually running or just marked as "live"

### High Priority Issues

#### 5. Fix Empty Frontier ⚠️
**Issue**: Frontier size is 0 despite 1,720 pending citations
- **Current State**: Frontier size 0, no items queued
- **Expected**: Frontier should contain items ready for processing
- **Actions**:
  - Verify frontier is being populated from pending citations
  - Check if `seedFrontierFromPlan()` is being called during run start
  - Verify pending citations are being added to frontier for processing
  - Check if citation processing pipeline is connected to discovery frontier
  - Verify `addToFrontier()` is being called with citation URLs
  - Check if frontier items are being drained without refilling

#### 6. Fix Anna's Archive Discovery Volume ⚠️
**Issue**: Only 1 item found (should be more)
- **Current State**: 1 item found, last extraction 4 days ago
- **Expected**: More Anna's Archive items should be discovered during planning
- **Actions**:
  - Verify `searchAnnasArchive()` is being called during planning
  - Check if Anna's Archive URLs are being discovered during plan generation
  - Verify Anna's Archive seeds are being added to frontier
  - Check if Anna's Archive is included in `primarySources` during plan generation
  - Verify `multiSourceOrchestrator.discover()` includes Anna's Archive search
  - Add logging to track Anna's Archive search execution and results

#### 7. Fix Frontier Population from Citations ⚠️
**Issue**: 1,720 citations pending but not being processed
- **Current State**: Citations exist but not being added to frontier
- **Expected**: Pending citations should be added to frontier for processing
- **Actions**:
  - Verify pending citations are being added to frontier
  - Check if citation processing pipeline is connected to discovery frontier
  - Verify `processWikipediaIncremental()` is being called
  - Check if citations are being enqueued to frontier with proper priority
  - Verify citation-to-frontier pipeline is working

### Medium Priority Issues

#### 8. Fix Metrics Calculation Errors ⚠️
**Issue**: Average processing time shows 16,481 minutes (clearly wrong), time to first save is negative
- **Current State**: Metrics are incorrect due to calculation errors
- **Expected**: Accurate metrics for monitoring and debugging
- **Actions**:
  - Fix calculation logic to handle edge cases and old data
  - Filter out invalid timestamps from calculations
  - Verify timestamp comparisons are correct
  - Add validation to prevent negative or unrealistic values
  - Check if old citations are skewing the average

#### 9. Verify Wikipedia Page Processing 🔍
**Issue**: Need to verify Wikipedia pages are being fetched (not just citations)
- **Current State**: Citations extracted but unclear if pages are processed
- **Expected**: Wikipedia pages should be fetched to extract deep links
- **Actions**:
  - Verify Wikipedia pages are being fetched in `processCandidate()`
  - Check if `fetchAndExtractContent()` is called for Wikipedia URLs
  - Verify `isWikipediaUrl()` detection is working
  - Check if Wikipedia pages trigger deep link extraction code path
  - Add logging to track Wikipedia page processing

#### 10. Improve Source Diversity 📊
**Issue**: 100% of discovered content is from Wikipedia citations
- **Current State**: No news, minimal Anna's Archive, no other sources
- **Expected**: Diverse sources: news, Anna's Archive, official sites, etc.
- **Actions**:
  - Verify `multiSourceOrchestrator` is discovering diverse sources
  - Check if diverse sources are being added to frontier
  - Verify plan generation includes all source types
  - Check if source filtering is too aggressive
  - Verify source priority/ranking is working correctly

### Low Priority / Enhancement Issues

#### 11. Add Comprehensive Logging for Deep Link Extraction 📝
**Issue**: Need visibility into deep link extraction process
- **Actions**:
  - Add logs when `enqueueWikipediaReferences()` is called
  - Add logs when `enqueueInternalWikipediaLinks()` is called
  - Add logs when `enqueueHtmlOutgoingReferences()` is called
  - Track how many links are extracted and enqueued
  - Log when Wikipedia pages are processed for deep links

#### 12. Verify Anna's Archive Content Extraction Quality 🔍
**Issue**: Only 152 characters extracted (very short)
- **Actions**:
  - Check if `extractBookContent()` is extracting full content or just preview
  - Verify content length thresholds are appropriate
  - Check if extraction is being truncated
  - Verify book content extraction is working correctly

#### 13. Add Run Health Monitoring 🏥
**Issue**: Need automatic detection of stuck runs
- **Actions**:
  - Implement automatic detection of stuck runs
  - Add timeout mechanism to mark runs as completed/suspended after inactivity
  - Add logging to track run state changes and activity
  - Create health check endpoint or cron job

#### 14. Verify Discovery Plan Includes All Sources 🔍
**Issue**: Need to verify plan generation includes all sources
- **Actions**:
  - Check if discovery plan generation includes Anna's Archive in `primarySources`
  - Verify plan includes news sources
  - Check if plan is being used to seed frontier with diverse sources
  - Verify `seedFrontierFromPlan()` uses all sources from plan

#### 15. Test End-to-End Discovery Flow After Fixes ✅
**Issue**: Need to verify complete flow works after fixes
- **Actions**:
  - Verify complete flow: plan generation → frontier seeding → Wikipedia page processing → deep link extraction → citation processing → Anna's Archive extraction → news extraction → saving → SSE events
  - Test with a fresh discovery run
  - Verify all sources are being discovered and processed
  - Verify metrics are accurate
  - Verify no stuck runs

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. Fix Wikipedia deep link extraction
2. Fix news source extraction
3. Fix processing stall
4. Fix stuck discovery runs

### Phase 2: High Priority (Do Next)
5. Fix empty frontier
6. Fix Anna's Archive discovery volume
7. Fix frontier population from citations

### Phase 3: Medium Priority (Do After Phase 2)
8. Fix metrics calculation errors
9. Verify Wikipedia page processing
10. Improve source diversity

### Phase 4: Enhancements (Do Last)
11. Add comprehensive logging
12. Verify Anna's Archive content quality
13. Add run health monitoring
14. Verify discovery plan includes all sources
15. Test end-to-end flow

---

## Expected Outcomes After Fixes

### Wikipedia Deep Links
- Outlinks extracted: > 0 (target: 50-100 per Wikipedia page)
- Internal links extracted: > 0 (target: 20-30 per Wikipedia page)
- Deep link extraction working for all Wikipedia pages processed

### News Sources
- News items processed: > 0 (target: 10-20 per discovery run)
- News sources in discovered content: > 0%
- NewsAPI integration working

### Processing Health
- Processing rate: > 0 citations/hour (target: 5-10/hour)
- No stuck runs
- Frontier populated with items ready for processing

### Source Diversity
- Wikipedia citations: < 80% (currently 100%)
- News sources: > 10%
- Anna's Archive: > 5%
- Other sources: > 5%

### Overall Metrics
- Total discovered items: Increasing
- Save rate: 15-25% (currently 19.6% - acceptable)
- Processing rate: Continuous (not stalled)
- No stuck runs

