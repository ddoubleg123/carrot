# Citation Extraction Issue Analysis

## Problem Identified

**8,521 out of 9,138 citations are relative Wikipedia links** (like `./Prime_Minister`) which are **NOT citations** - they're internal Wikipedia page references.

## Root Cause

Looking at the code in `wikipediaCitation.ts` (lines 39-54), the system is:

1. ✅ Correctly extracting citations from References/External links sections
2. ✅ Correctly filtering out relative links in `wikiUtils.ts` (line 284)
3. ❌ **BUT** still storing relative links in the database

The issue is in `wikipediaCitation.ts`:
- It separates Wikipedia links from external citations
- But it STILL stores Wikipedia links in the database
- These are marked with `verificationStatus: 'pending_wiki'` but they shouldn't be stored as citations at all

## What Should Happen

**Relative Wikipedia links (./PageName) should NOT be stored as citations** because:
- They are internal Wikipedia references, not source citations
- They link to other Wikipedia pages, not external sources
- They don't provide source material for the article

## Current Statistics (Incorrect)

- Total in DB: 9,138
- External URLs: 597 (6.5%) ✅ Correct
- Wikipedia Links: 8,541 (93.5%) ❌ **These shouldn't be citations**

## Expected Statistics

If we only stored actual citations:
- Total Citations: ~597 (external URLs only)
- Wikipedia Links: 0 (not stored as citations)

## Impact

1. **Inflated citation counts** - makes it look like pages have thousands of citations when they actually have dozens
2. **Wasted storage** - storing 8,541 non-citation entries
3. **Confusing metrics** - save rates, processing stats are skewed
4. **Processing overhead** - system tries to process these as if they were citations

## Solution

1. **Don't store relative Wikipedia links** in the `wikipedia_citations` table
2. If we want to track Wikipedia page relationships, use a separate table (e.g., `wikipedia_page_links`)
3. Only store actual external citations (http/https URLs that aren't Wikipedia domains)

## Real Citation Statistics (After Fix)

Based on the analysis:
- **Actual External Citations**: 597
- **Processed**: 423 (70.9%)
- **Saved**: 52 (12.3% of processed, 8.7% of total)
- **Content Extracted**: 268 (50.3% of scanned)
- **Total Content**: 1.69M chars
- **Saved Content**: 410K chars

These are the real numbers we should be tracking.

