# Plan: Extract ALL External URLs from Wikipedia Pages

## Current Problem

We're only extracting ~19 external URLs from the Apartheid page, but there should be hundreds based on the "References", "Further reading", and "External links" sections.

## Current Extraction

**Location**: `carrot/src/lib/discovery/wikiUtils.ts:extractWikipediaCitationsWithContext()`

**What it does**:
- Only looks at `<ol class="references">` section
- Extracts URLs from `<li>` items
- Filters out Wikipedia links (good)
- Limits to 10,000 (good)

**What it's missing**:
- "Further reading" section
- "External links" section  
- Inline citations in the text
- Different HTML structures

## Solution: Comprehensive External URL Extraction

### Step 1: Extract from ALL sections

1. **References section** (already doing this)
   - `<ol class="references">` or `<div class="reflist">`
   - Extract all `<a href="...">` links that are external

2. **Further reading section**
   - Look for `<h2>Further reading</h2>` or similar
   - Extract all `<ul>` or `<ol>` items with external links

3. **External links section**
   - Look for `<h2>External links</h2>` or similar
   - Extract all `<ul>` or `<ol>` items with external links

4. **Inline citations**
   - Look for `<sup>` tags with citation links
   - Follow those to the reference list

### Step 2: Filter correctly

- ✅ Keep: External URLs (not wikipedia.org, wikimedia.org, etc.)
- ✅ Keep: Archive.org links (web.archive.org)
- ❌ Skip: Wikipedia internal links (./History_of_South_Africa)
- ❌ Skip: Wikimedia domains (wikidata.org, wikiquote.org, etc.)
- ❌ Skip: Library catalogs (id.loc.gov, catalog.archives.gov, etc.) - but maybe keep these for now?

### Step 3: Store in database

- Store ALL external URLs in `WikipediaCitation` table
- Mark them as `scanStatus: 'not_scanned'`
- Don't filter by relevance yet - just store everything

## Implementation Plan

1. **Create new function**: `extractAllExternalUrls(html, sourceUrl)`
   - Extracts from References, Further reading, External links
   - Returns array of unique external URLs

2. **Update `extractAndStoreCitations()` in `wikipediaCitation.ts`**
   - Use new comprehensive extraction
   - Store ALL external URLs, not just references

3. **Test on Apartheid page**
   - Should find 100+ external URLs instead of 19

## Next Steps After This

1. Once all URLs are stored, process them for relevance
2. Score with DeepSeek
3. Save relevant ones to DiscoveredContent

