# Discovery Process Issues Analysis

## Current Problems

### 1. **Nothing Being Saved (persisted:0)**
From logs:
- `"persisted":0` - No content is being saved
- `"fetched":7` - 7 items fetched
- `"saved":0` - 0 items saved
- `"duplicates":1` - 1 duplicate found

**Root Cause**: Content is being fetched but failing relevance/acceptance criteria.

### 2. **No Wikipedia Priority Levels**
**Current State**: 
- Wikipedia pages are processed but not tracked by "level"
- No distinction between seed Wikipedia pages (Level 1) and linked pages (Level 2+)

**Expected Behavior**:
- Level 1: Seed Wikipedia pages from discovery plan
- Level 2: Wikipedia pages linked from Level 1 pages
- Level 3: Wikipedia pages linked from Level 2 pages
- Process by priority: Level 1 → Level 2 → Level 3

### 3. **No Wikipedia-to-Wikipedia Crawling**
**Current State**:
- System extracts external URLs from Wikipedia citations
- Does NOT extract internal Wikipedia links to crawl more Wikipedia pages

**Expected Behavior**:
- Extract internal Wikipedia links from each page
- Enqueue them with appropriate priority level (Level 2 if from Level 1, etc.)
- Process them to extract their citations

### 4. **Missing Parent Wikipedia Page Tracking**
**Current State**:
- External URLs are stored in `WikipediaCitation` table
- `monitoring.wikipediaTitle` tracks which Wikipedia page it came from
- BUT: No reference number (1, 2, 3, etc.) is stored
- Cannot answer: "What is reference #5 from the Israel Wikipedia page?"

**Expected Behavior**:
- Store `citationIndex` or `referenceNumber` for each citation
- Be able to query: "Show me the next 5 external URLs to process, with their Wikipedia source and reference numbers"

### 5. **Insufficient Seeds**
**Current State**: Only 1 seed candidate for Israel patch
**Expected**: 10+ seed candidates

## Fixes Needed

### Fix 1: Regenerate Discovery Plan with 10+ Seeds
- Force regeneration of guide for Israel patch
- Ensure AI generates ≥10 seed candidates

### Fix 2: Add Wikipedia Priority Levels
- Add `wikipediaLevel` field to track priority (1, 2, 3, etc.)
- Seed Wikipedia pages = Level 1
- Wikipedia pages linked from Level 1 = Level 2
- And so on...

### Fix 3: Implement Wikipedia-to-Wikipedia Crawling
- Extract internal Wikipedia links from each processed page
- Enqueue them with `wikipediaLevel = parentLevel + 1`
- Process them to extract citations

### Fix 4: Track Reference Numbers
- Store `citationIndex` in `WikipediaCitation` table
- Update queries to include reference number
- Create script to show next URLs with their Wikipedia source and reference numbers

### Fix 5: Debug Why Nothing Is Saved
- Check relevance threshold (currently 60)
- Check acceptance criteria
- Add detailed logging for why items are rejected
