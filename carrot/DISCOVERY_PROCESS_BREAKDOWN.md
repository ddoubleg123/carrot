# Discovery Process Breakdown & Fixes

## Current Status

### ✅ Fixed Issues

1. **Citations Not Being Processed**
   - **Problem**: 8,678 citations had `verificationStatus: 'failed'` and were filtered out
   - **Fix**: Updated `getNextCitationToProcess` to include `'failed'` status
   - **Result**: Now 8,670 citations are available for processing

2. **Script Created**
   - `scripts/show-next-external-urls.ts` - Shows next URLs with Wikipedia source and reference numbers

### 🔍 Key Findings

**From Database Analysis:**
- **Total External URLs**: 8,827
- **Processed (with decision)**: 149
- **Pending**: 8,678
- **Scan Status**: 8,670 `not_scanned`, 8 `scanning`, 149 `scanned`
- **Verification Status**: 8,678 `failed`, 149 `verified`
- **Relevance Decision**: 149 `denied`, 8,678 `NULL` (pending)

**From Logs:**
- Discovery ran but saved **0 items** (`persisted:0`)
- Processed 7 items, found 1 duplicate
- Extracted 25 citations from Israel Wikipedia page, enqueued 9

### ❌ Missing Features

1. **No Wikipedia Priority Levels**
   - System doesn't track which "level" a Wikipedia page is
   - Level 1 = seed pages, Level 2 = linked from Level 1, etc.
   - **Impact**: Can't prioritize processing by depth

2. **No Wikipedia-to-Wikipedia Crawling**
   - `extractOutgoingLinks` explicitly skips Wikipedia links (line 232)
   - System only extracts external URLs from citations
   - **Impact**: Can't discover more Wikipedia pages to extract citations from

3. **Reference Numbers Not Fully Utilized**
   - `sourceNumber` is stored but not displayed in queries
   - **Impact**: Can't easily see "Reference #5 from Israel page"

4. **Insufficient Seeds**
   - Only 1 seed candidate for Israel patch
   - **Impact**: Limited starting points for discovery

## What Needs to Be Done

### Priority 1: Fix Why Nothing Is Saved
- **Issue**: `persisted:0` - content fetched but not saved
- **Investigation Needed**:
  - Check relevance threshold (currently 60)
  - Check acceptance criteria
  - Review logs for rejection reasons

### Priority 2: Add Wikipedia-to-Wikipedia Crawling
- **Implementation**:
  1. Create `extractInternalWikipediaLinks()` function
  2. Extract links from processed Wikipedia pages
  3. Enqueue them with priority level metadata
  4. Process them to extract their citations

### Priority 3: Add Priority Levels
- **Implementation**:
  1. Add `wikipediaLevel` to frontier item metadata
  2. Seed pages = Level 1
  3. Pages from Level 1 = Level 2
  4. Process by level: Level 1 → Level 2 → Level 3

### Priority 4: Regenerate Seeds
- Force regeneration of discovery plan for Israel patch
- Ensure 10+ seed candidates

## Next Steps

1. **Immediate**: Debug why nothing is saved (check relevance/acceptance)
2. **Short-term**: Add Wikipedia-to-Wikipedia crawling
3. **Short-term**: Add priority levels
4. **Short-term**: Regenerate seeds

