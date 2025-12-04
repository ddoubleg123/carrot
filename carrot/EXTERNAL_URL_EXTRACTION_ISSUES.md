# External URL Extraction Issues - Root Cause Analysis

## Problem Summary

**Issue**: Only 15 external URLs found in database for Zionism page, but audit shows 1,273 external URLs should exist.

**Root Cause**: The extraction function `extractWikipediaCitationsWithContext` only extracts from the **References section** (footnotes), but Wikipedia pages have external URLs in multiple sections:
1. References section (footnotes) ✅ Currently extracted
2. Further reading section ❌ NOT extracted
3. External links section ❌ NOT extracted  
4. See also section (usually Wikipedia internal, but sometimes external) ❌ NOT extracted

## Current Extraction Flow

### Step 1: Wikipedia Page Processing
- `processNextWikipediaPage` calls `WikipediaSource.getPage()`
- `WikipediaSource.getPage()` calls `extractCitations()` which:
  - Extracts from References section
  - Extracts from External links section
  - Returns citations

### Step 2: Citation Storage
- If `page.citations` has citations, they're filtered and stored
- If `page.citations` is empty, falls back to `extractWikipediaCitationsWithContext()`
- `extractWikipediaCitationsWithContext()` **ONLY** extracts from References section

### Step 3: The Problem
- `WikipediaSource.extractCitations()` extracts from References + External links
- But `extractWikipediaCitationsWithContext()` (fallback) only extracts from References
- If `WikipediaSource.getPage()` doesn't find citations, we lose the External links section URLs

## Code Analysis

### `extractWikipediaCitationsWithContext` (wikiUtils.ts:259)
- **Only extracts from**: References section (`<ol class="references">`)
- **Filters out**: Wikipedia internal links (./, /wiki/, wikipedia.org)
- **Limit**: 10,000 citations (but only from References section)

### `extractAllExternalUrls` (wikiUtils.ts:108) - Used by audit
- **Extracts from**: References, Further reading, External links, See also
- **Includes**: All URLs (including Wikipedia internal, which it shouldn't)
- **Used by**: Audit function only

### `WikipediaSource.extractCitations` (wikipediaSource.ts:140)
- **Extracts from**: References section + External links section
- **Filters out**: Wikipedia internal links
- **Used by**: `WikipediaSource.getPage()`

## The Gap

1. **References section**: ✅ Extracted by both methods
2. **External links section**: ✅ Extracted by `WikipediaSource.extractCitations()`, ❌ NOT by `extractWikipediaCitationsWithContext()`
3. **Further reading section**: ❌ NOT extracted by either method
4. **See also section**: ❌ NOT extracted by either method (but usually Wikipedia internal anyway)

## Why Only 15 URLs in Database?

1. `WikipediaSource.getPage()` may have failed or returned empty citations
2. System fell back to `extractWikipediaCitationsWithContext()` which only gets References section
3. References section may have only 15 external URLs (rest are Wikipedia internal)
4. External links and Further reading sections were never extracted

## Solution Required

Update `extractWikipediaCitationsWithContext` to extract from ALL sections:
- References section (current)
- Further reading section (missing)
- External links section (missing)
- See also section (optional, usually Wikipedia internal)

This matches what `extractAllExternalUrls` does, but with proper filtering.

