# Wikipedia Reference Extraction Fix

## Problem Identified

The extraction was only finding **0 external URLs** from the References section, despite the Zionism page having **439 external URLs** in references.

### Root Cause

The extraction function `extractWikipediaCitationsWithContext` was only looking in the References `<ol>` (ordered list) section, which contains inline citation references. However, the actual external URLs are primarily located in:

1. **Works cited section** - A bibliography section that comes after the References `<ol>`
2. **Reference text** - URLs embedded within individual reference items (including archive URLs)
3. **Citation templates** - URLs stored in citation template attributes

## Solution

Updated `extractWikipediaCitationsWithContext` in `wikiUtils.ts` to:

1. **Extract from entire References area** - Not just the `<ol>`, but everything from the References h2 heading until the next section
2. **Extract from Works cited section** - Specifically look for and parse the Works cited bibliography
3. **Extract ALL URLs from each reference** - Not just the first URL, but all URLs including:
   - Source URLs
   - Archive URLs (web.archive.org, archive.org)
   - Access URLs
   - Plain text URLs in reference text

## Results

### Before Fix
- **0 external URLs** found in References section
- Only extracting from References `<ol>` (which had no external URLs)

### After Fix
- **422 external URLs** found total
- **318 from Works cited** section
- **72 from References** (inline citations)
- **22 from External links**
- **10 from Further reading**

### Breakdown by Domain
- books.google.com: 87
- web.archive.org: 76
- doi.org: 59
- search.worldcat.org: 26
- jstor.org: 25
- api.semanticscholar.org: 21
- archive.org: 5
- cambridge.org: 4
- haaretz.com: 4
- forward.com: 4

## Implementation Details

The updated extraction:

1. **Finds References area**: Matches `<h2>References</h2>` and captures everything until the next h2
2. **Extracts from References `<ol>`**: Processes inline citations with `cite_note-*` IDs
3. **Extracts from Works cited**: Looks for Works cited section (h2 or h3) and processes all `<li>` items
4. **Multiple URL patterns**: Uses multiple regex patterns to find:
   - `<a href>` tags
   - Plain text URLs (http://...)
   - Citation template attributes (url=, website=, access-url=, archive-url=)
   - "Archived from the original" links
5. **Deduplication**: Uses canonical URLs to prevent duplicates
6. **Wikipedia filtering**: Filters out Wikipedia/Wikimedia/Wikidata URLs

## Next Steps

1. ✅ Extraction now finds 422 URLs (close to the 439 expected)
2. ⏳ Test on other Wikipedia pages to ensure consistency
3. ⏳ Run backfill to extract URLs from previously processed pages
4. ⏳ Monitor extraction quality in production

## Files Modified

- `carrot/src/lib/discovery/wikiUtils.ts` - Updated `extractWikipediaCitationsWithContext` function

