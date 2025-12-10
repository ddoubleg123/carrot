# Discovery Run Audit Report - Israel Patch
**Run ID:** `cmizalvgc0001n01tbrq25cev`  
**Patch:** `israel` (cmip4pwb40001rt1t7a13p27g)  
**Duration:** 498 seconds (8.3 minutes)  
**Status:** Suspended (stopped manually)

---

## 📊 STATISTICS SUMMARY

### Wikipedia Pages & Citations
- **Total Wikipedia Pages in Monitoring:** 25 pages
  - Status: 16 completed, 9 scanning
  - All pages have `contentScanned: true` and `citationsExtracted: true`
  
- **Total Citations in Database:** 8,839 citations
  - **Already Scanned:** 238 citations
  - **Already Have Relevance Decision:** 8,839 citations (100%)
  - **Failed Verification:** 8,685 citations
  - **Currently Scanning:** 0 citations
  - **Pending/Verified External URLs:** 0 citations
  - **Pending Wikipedia Internal Links:** 0 citations

### Discovery Engine Activity
- **URLs Processed:** 10 URLs
- **Items Saved:** 0 items ❌
- **Duplicates Found:** 1 duplicate
- **Failures:** 0 failures
- **Frontier Queue Size:** 2000+ URLs (at end of run)

### URLs Processed (What Was Actually Fetched)
1. `https://en.wikipedia.org/wiki/Israel` - Wikipedia main page (for deep link extraction)
2. `https://archive.mid.ru/en/foreign_policy/news/-/asset_publisher/cKNonkJE02Bw/content/id/2717182` - Duplicate (already exists)
3. `https://google.com/search?q=site:espn.com%20https://www.nba.com/bulls/news&tbm=nws` - Google search result (not saved)
4. `https://google.com/search?q=site:nba.com%20https://www.nba.com/bulls/news&tbm=nws` - Google search result (not saved)
5. `https://google.com/search?q=https://www.nba.com/bulls/news%20scandal&tbm=nws` - Google search result (not saved)
6. `https://google.com/search?q=Israel%20scandal&tbm=nws` - Google search result (not saved)
7-10. More Google search results (not saved)

---

## 🔍 ROOT CAUSE ANALYSIS

### Problem 1: All Citations Already Processed
**Issue:** The `getNextCitationToProcess` function requires `relevanceDecision: null`, but ALL 8,839 citations already have a relevance decision from a previous run.

**Evidence from Logs:**
```
[WikipediaCitation] Diagnostic breakdown:
  Total citations: 8839
  Already scanned: 238
  Already have relevanceDecision: 8839  ← ALL citations have decisions
  Failed verification: 8685
  Currently scanning: 0
  ℹ️  All citations have a relevance decision
```

**Impact:** No citations can be processed because the query filters for `relevanceDecision: null`, which returns 0 results.

### Problem 2: Wikipedia Incremental Processing Returns Nothing
**Issue:** `processWikipediaIncremental` is called every 30 seconds, but it finds:
- No pages to process (all 25 pages are completed)
- No citations to process (all have relevance decisions)

**Evidence from Logs:**
```
[WikipediaProcessor] Processing up to 1 pages and 50 citations (25 pages in monitoring table)
[WikipediaMonitoring] No pages available to process for patch cmip4pwb40001rt1t7a13p27g
[WikipediaCitation] No citations available to process for patch cmip4pwb40001rt1t7a13p27g
```

### Problem 3: Frontier Only Finding Google Search Results
**Issue:** The discovery engine is processing Google search result pages instead of actual articles. These are not being saved because:
- They're search result pages, not actual content
- They likely fail relevance scoring
- They're marked as `summary_skipped` in the logs

**Evidence from Logs:**
```
[Audit] persisted event {
  step: 'summary_skipped',
  status: 'ok',
  ...
}
```

### Problem 4: Query Expansion Generating Wrong Queries
**Issue:** The query expander is generating queries like:
- `site:espn.com https://www.nba.com/bulls/news` (wrong topic - this is for Bulls, not Israel)
- `site:nba.com https://www.nba.com/bulls/news` (wrong topic)
- `Israel scandal` (correct topic but generic)

**Evidence from Logs:**
```
[Seed Planner] Only 1 seeds from planner, adding 3 fallback seeds
[Seed Planner] seed_warn_low_diversity: Only 4 unique domains (absolute minimum: 5)
```

The seed planner only found 1 seed, so it added 3 fallback seeds, which may have included incorrect topics.

---

## 🐛 SPECIFIC BUGS IDENTIFIED

### Bug 1: Citation Processing Query Too Restrictive
**Location:** `carrot/src/lib/discovery/wikipediaCitation.ts:224`
```typescript
relevanceDecision: null, // Only process citations that haven't been decided yet
```

**Problem:** Once a citation has been processed (even if it was denied), it can never be reprocessed. This means:
- If a citation was incorrectly marked as "not relevant" in a previous run, it can't be re-evaluated
- If the relevance scoring logic improved, old citations can't benefit from it
- The system can't recover from previous processing errors

**Fix Needed:** Add logic to allow reprocessing citations that:
1. Were denied but have high AI priority scores (>60)
2. Were processed more than X days ago (to allow re-evaluation with improved logic)
3. Have a manual flag to allow reprocessing

### Bug 2: No New Wikipedia Pages Being Added
**Issue:** The system processed Wikipedia pages and extracted citations, but:
- No new Wikipedia pages are being added to monitoring from the citations
- The 25 pages in monitoring are all marked as "completed"
- The system isn't discovering new Wikipedia pages to crawl

**Evidence:** All 25 pages show `contentScanned: true, citationsExtracted: true, status: completed`

### Bug 3: Query Expansion Using Wrong Context
**Issue:** The query expander is generating queries for "Bulls" (NBA team) when the patch is about "Israel". This suggests:
- The seed planner is using incorrect aliases or context
- The query expander is not properly filtering by patch topic
- There may be cached/incorrect data from a previous patch

**Evidence:**
```
[Seed Planner] Only 1 seeds from planner, adding 3 fallback seeds
[Query Expander] topic: "https://www.nba.com/bulls/news"  ← WRONG TOPIC
```

---

## 💡 RECOMMENDATIONS

### Immediate Fixes

1. **Reset Citations for Reprocessing**
   - Add a function to reset citations that were denied but have high AI scores
   - Allow reprocessing of citations processed more than 7 days ago
   - Add a manual "reprocess" flag for citations

2. **Fix Query Expansion Context**
   - Ensure query expander uses the correct patch topic (Israel, not Bulls)
   - Clear any cached query expansion data
   - Add validation to prevent queries for wrong topics

3. **Improve Seed Planning**
   - The seed planner only found 1 seed for Israel patch
   - Add more fallback seeds specific to the patch topic
   - Ensure seeds are relevant to the patch (not generic or from other patches)

4. **Add New Wikipedia Pages**
   - Manually trigger discovery of new Wikipedia pages related to Israel
   - Add Wikipedia pages from the citations that were already processed
   - Consider adding Wikipedia pages from related topics (Palestine, Middle East, etc.)

### Long-term Improvements

1. **Citation Reprocessing Logic**
   - Add a "reprocess" queue for citations that should be re-evaluated
   - Implement time-based reprocessing (e.g., reprocess every 30 days)
   - Add confidence scores to relevance decisions

2. **Better Frontier Management**
   - Filter out Google search results from the frontier
   - Prioritize actual article URLs over search result pages
   - Add URL validation before adding to frontier

3. **Wikipedia Page Discovery**
   - Automatically add Wikipedia pages from citations
   - Discover related Wikipedia pages through internal links
   - Add Wikipedia pages from related topics

---

## 📈 METRICS BREAKDOWN

### Processing Metrics (from WikipediaProcessor)
```
totalProcessed: 16
extractionRate: 0.0%
minLen500Rate: 0.0%
isArticleRate: 0.0%
saveRate: 0.0%
savedWithScore60Plus: 0
```

**Interpretation:** The Wikipedia processor attempted to process 16 citations, but:
- None reached extraction (likely because they were already processed)
- None passed minimum length checks
- None were identified as articles
- None were saved

### Discovery Metrics (from EngineV21)
```
Total processed: 1
Novel items: 0
Duplicates: 1
Novel rate: 0.0%
Duplicates per minute: 1.57
Items per hour: 0.00
Provider error rate: 0.0%
```

**Interpretation:** The discovery engine processed very few items, and none were novel (new).

---

## ✅ CONCLUSION

The discovery run found **ZERO new content** because:

1. **All Wikipedia citations were already processed** in a previous run (8,839 citations, all have relevance decisions)
2. **No new Wikipedia pages** are being discovered or added to monitoring
3. **The frontier is full of Google search results** instead of actual article URLs
4. **Query expansion is generating wrong queries** (Bulls instead of Israel) - **FIXED** ✅

**Next Steps:**
1. ✅ **FIXED:** Hardcoded Bulls aliases bug in `engineV21.ts:1141` - now uses dynamic aliases from patch name/handle
2. Reset citations for reprocessing (especially high-scoring ones that were denied)
3. Add new Wikipedia pages to monitoring
4. Clear Google search results from frontier
5. Manually trigger discovery of new Wikipedia pages related to Israel

---

## 🔧 FIXES APPLIED

### Fix 1: Hardcoded Aliases Bug (FIXED)
**File:** `carrot/src/lib/discovery/engineV21.ts:1138-1141`

**Before:**
```typescript
const topic = this.options.patchHandle || 'Chicago Bulls'
const aliases = ['Michael Jordan', 'Chicago Bulls', 'basketball', 'NBA']
```

**After:**
```typescript
const topic = this.options.patchName || this.options.patchHandle || 'unknown'
const aliases: string[] = []
if (this.options.patchName && this.options.patchName !== topic) {
  aliases.push(this.options.patchName)
}
if (this.options.patchHandle && this.options.patchHandle !== topic) {
  aliases.push(this.options.patchHandle)
}
```

**Impact:** Query expansion will now use the correct patch context (Israel) instead of hardcoded Bulls aliases.

