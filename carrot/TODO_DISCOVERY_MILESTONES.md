# Discovery Process Milestones & TODO List

**Created:** 2025-12-28  
**Current Status:** 41.4% Complete

---

## 🎯 MILESTONES

### Milestone 1: Citation Discovery ✅
- [x] Extract citations from Wikipedia pages
- [x] Store citations in database
- [x] Track citation metadata
- **Status:** 2,985 citations discovered

### Milestone 2: Citation Processing ⏳ (29.9% Complete)
- [x] Scan citations for content
- [x] Score citations for relevance
- [ ] Process all citations (1,713 remaining)
- **Status:** 891/2,985 scanned (29.9%)

### Milestone 3: Relevance Scoring ✅
- [x] AI scoring system (DeepSeek)
- [x] Store relevance scores (0-100)
- [x] Track relevance decisions (saved/denied)
- **Status:** 2,630 citations scored (avg: 50.72)

### Milestone 4: Content Saving ⏳ (6.6% Complete)
- [x] Save relevant citations to DiscoveredContent
- [ ] Save all relevant citations (2,326 remaining)
- [ ] Review save threshold (currently 50)
- **Status:** 165/2,491 relevant saved (6.6%)

### Milestone 5: Content Extraction ✅ (99.4% Complete)
- [x] Extract text content from saved items
- [x] Store full text in textContent field
- [ ] Extract remaining 1 item (if any)
- **Status:** 164/165 saved items extracted (99.4%)

### Milestone 6: Agent Learning ⏳
- [x] Feed queue system
- [x] AgentMemory creation
- [ ] Verify all saved content creates memories
- **Status:** 131 AgentMemory entries from 165 saved

### Milestone 7: Completion Tracking ✅
- [x] Completion audit script
- [x] Completion formula
- [x] Progress tracking
- [ ] Integrate into discovery engine
- **Status:** 41.4% overall completion

---

## 📋 TODO LIST

### 🔴 CRITICAL PRIORITY

#### 1. Fix Scheduler Guard Deadlock
**Problem:** All frontier items blocked, engine spinning in loop
- [ ] Identify specific guard blocking (Wiki Low Diversity, Contested Bias, etc.)
- [ ] Add fallback logic when all candidates rejected
- [ ] Increase retry limit or relax guards when stuck
- [ ] Test that engine can process items after fix
- **Impact:** Blocks all processing (0 items saved in current run)

#### 2. Fix Low Save Rate (6.6% of relevant)
**Problem:** Only 165/2,491 relevant citations saved
- [ ] Review save threshold (currently 50)
- [ ] Check save logic in processNextCitation
- [ ] Verify relevanceDecision is being set correctly
- [ ] Test saving with different score thresholds
- **Impact:** 2,326 relevant citations not being saved

#### 3. Process Remaining Citations (1,713)
**Problem:** Only 29.9% of citations scanned
- [ ] Unblock scheduler guards
- [ ] Continue citation processing
- [ ] Monitor processing rate
- [ ] Verify all citations get scanned
- **Impact:** 1,713 citations not yet processed

---

### 🟡 HIGH PRIORITY

#### 4. Create Citation Dashboard/Test Page
**Request:** Show all citations with status, scores, extraction, saving, agent learning
- [ ] Create API endpoint for citation data
- [ ] Create test page component
- [ ] Display citation list with filters
- [ ] Show relevance scores
- [ ] Show extraction status (success/error)
- [ ] Show save status
- [ ] Show agent learning status (AgentMemory)
- [ ] Add search/filter capabilities
- **Impact:** Visibility into citation processing status

#### 5. Integrate Completion Tracking
**Request:** Engine should check completion and stop when done
- [ ] Add completion check to discovery engine
- [ ] Stop engine when 100% complete
- [ ] Report progress in logs
- [ ] Add completion status to metrics
- **Impact:** Know when discovery is done

#### 6. Verify Agent Learning Pipeline
**Problem:** Only 131 memories from 165 saved items
- [ ] Check AgentMemoryFeedQueue processing
- [ ] Verify feed worker is running
- [ ] Check for errors in memory creation
- [ ] Ensure all saved content creates memories
- **Impact:** Agent not learning from all saved content

---

### 🟢 MEDIUM PRIORITY

#### 7. Review Save Threshold
**Problem:** Save rate seems low
- [ ] Analyze score distribution
- [ ] Review threshold of 50
- [ ] Consider adjusting based on data
- [ ] Test different thresholds
- **Impact:** May increase save rate

#### 8. Add Completion Monitoring
**Request:** Track completion over time
- [ ] Schedule regular completion audits
- [ ] Create completion dashboard
- [ ] Alert on completion milestones
- [ ] Track completion trends
- **Impact:** Better visibility into progress

#### 9. Fix Anna's Archive Extraction
**Problem:** Only 1/14 books saved historically
- [ ] Test PDF extraction
- [ ] Review relevance filtering
- [ ] Check content validation
- [ ] Verify extraction pipeline
- **Impact:** Missing book content

#### 10. Verify NewsAPI Extraction
**Problem:** Need to verify full article extraction
- [ ] Test NewsAPI article extraction
- [ ] Verify full text is extracted
- [ ] Check save pipeline
- **Impact:** Missing news content

---

## 📊 COMPLETION TRACKING

### Current Metrics (2025-12-28)
- **Citations Processed:** 29.9% (891/2,985)
- **Relevant Saved:** 6.6% (165/2,491)
- **Relevant Extracted:** 99.4% (164/165)
- **Overall Completion:** 41.4%
- **Is Complete:** ❌ NO

### Target: 100% Completion
- [ ] All citations scanned
- [ ] All relevant citations saved
- [ ] All saved citations extracted
- [ ] All saved content creates AgentMemory

### Remaining Work
- **Citations to Scan:** 1,713
- **Relevant to Save:** 2,326
- **Saved to Extract:** 0 ✅

---

## 🎯 SUCCESS CRITERIA

Discovery is **complete** when:
1. ✅ All citations scanned (currently 29.9%)
2. ✅ All relevant citations saved (currently 6.6%)
3. ✅ All saved citations extracted (currently 99.4%) ✅
4. ✅ All saved content creates AgentMemory (currently 79.4%)

**Formula:**
```
Overall = (Processed × 30%) + (Saved × 40%) + (Extracted × 30%)
Target: 100%
```

---

**Last Updated:** 2025-12-28  
**Next Review:** After scheduler guard fix

