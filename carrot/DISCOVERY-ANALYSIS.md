# Discovery Analysis - Why No Items Were Saved

## Summary from Render Logs

Based on the render logs from the last discovery run:

### What the Discovery Tried to Do:
- **Prioritized 25 citations** from Wikipedia page "Israel"
- **Attempted to process citations** but found **0 citations available**
- **Result: 0 items saved, 0 items processed**

### The Problem:

1. **Step 1 Query (New Citations)**: Found **0 citations**
   - All citations have already been scanned
   - All have a `relevanceDecision` (saved or denied)
   - No new citations to process

2. **Step 3 Query (High-Score Denied)**: Found **0 citations** (but should have found 8!)
   - **Root Cause**: 30-day requirement blocked recent high-scoring denied citations
   - Citation `cmip9so2u0561ox1t56gue2ye` (score 95) was scanned 2 days ago
   - 8 high-scoring denied citations (<30 days old) were blocked from reprocessing

## The Specific Issue: Citation cmip9so2u0561ox1t56gue2ye

### Citation Details:
- **AI Priority Score**: 95 (excellent!)
- **Relevance Decision**: denied ❌
- **Scan Status**: scanned
- **Verification Status**: verified ✅
- **Content Length**: 7,574 chars (plenty of content)
- **Last Scanned**: 2 days ago (2025-12-07)
- **URL**: https://aljazeera.com/news/longform/2024/4/15/mapping-israel-lebanon-cross-border-attacks

### Why It Was Denied:
The citation was denied because of the `isActualArticle` check failing. Even though:
- AI gave it a score of 95
- AI said `isRelevant: true`
- Content is substantial (7,574 chars)

The local `isActualArticle` heuristic failed (likely missing required keywords like "article", "published", etc.), causing the final `isRelevant` to be `false`.

### Why It Wasn't Reprocessed:
The Step 3 query required citations to be **30+ days old** before reprocessing. Since this citation was scanned 2 days ago, it was blocked.

## The Fix

### 1. Fixed Citation Scoring Logic
- **File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`
- **Change**: Trust AI judgment for high-scoring content (score >= 60)
- **Result**: High-scoring citations will now be saved even if local heuristics fail

### 2. Removed 30-Day Requirement
- **File**: `carrot/src/lib/discovery/wikipediaCitation.ts`
- **Change**: Removed 30-day requirement for high-scoring denied citations
- **Result**: High-scoring denied citations can be reprocessed immediately

## Current State

### Available Citations for Processing:
- **Step 1 (New)**: 0 citations
- **Step 3 (High-Score Denied, <30 days)**: 8 citations (now processable!)
  - Score 95: 2 citations (including cmip9so2u0561ox1t56gue2ye)
  - Score 85: 4 citations
  - Score 75: 2 citations

### Next Discovery Run Should:
1. Find 8 high-scoring denied citations immediately
2. Reprocess them with the fixed scoring logic
3. Save them to DiscoveredContent (they should pass now)

## Recommendations

1. **Run discovery again** - It should now find and process the 8 high-scoring denied citations
2. **Monitor the logs** - Verify that citations are being selected and processed
3. **Check results** - Verify that high-scoring citations are being saved correctly

## Statistics from Analysis

- **Total Citations**: 8,839
- **High-Score Denied (<30 days)**: 8 citations (now processable)
- **High-Score Denied (30+ days)**: 0 citations
- **New Citations**: 0 citations

The discovery should now process these 8 high-scoring citations on the next run.

