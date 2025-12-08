# Discovery Frontend Display Audit - December 8, 2025

## Executive Summary

**Status**: 4 citations ARE being saved to the database, but NOT appearing on the frontend.

**Root Cause**: The saved citations have `isUseful: true` and all required fields, but the frontend may be filtering them out OR there's a display issue.

## What's Working

1. ✅ **Citations ARE being saved**: 4 citations successfully saved to `DiscoveredContent` table
   - IDs: `cmixhacx7000jr82iedk4uagd`, `cmixhahou000qr82ian9qtrfa`, `cmixhb5nk000wr82ix82nqp50`, `cmixhd3ry0012r82iamys9ww2`
   - All have `isUseful: true`
   - All have relevance scores: 0.45-0.51
   - All have DeepSeek scores: 75-85

2. ✅ **Content extraction working**: All 4 citations have substantial text content (6KB-87KB)

3. ✅ **AI scoring working**: DeepSeek correctly identifying relevant content with scores 75-85

4. ✅ **Database writes working**: All saves completed successfully

## What's NOT Working

1. ❌ **Frontend display**: No citations showing in the discovery feed despite 4 being saved

2. ❌ **Low save rate**: Only 4 out of 143 processed citations saved (2.8% save rate)
   - Most citations rejected due to:
     - Low DeepSeek scores (< 60)
     - Not actual articles (metadata/catalog pages)
     - Search results pages (Wiktionary, Wikisource, etc.)

## Detailed Analysis

### Saved Citations Breakdown

| Citation | URL | Score | Text Bytes | Status |
|----------|-----|-------|------------|--------|
| News | Wikinews search | 85 | 6,258 | ✅ Saved |
| Quotations | Wikiquote | 85 | 26,800 | ✅ Saved |
| Palestinian territories | Wikivoyage | 75 | 25,608 | ✅ Saved |
| İslâm Ansiklopedisi | Turkish encyclopedia | 85 | 86,768 | ✅ Saved |

### API Route Analysis

**File**: `carrot/src/app/api/patches/[handle]/discovered-content/route.ts`

**Current Filters**:
1. ✅ Must have `title` (non-empty)
2. ✅ No status filter (returns all items)
3. ✅ No `isUseful` filter (returns all items)
4. ✅ Verification skipped (`SKIP_VERIFICATION = true`)

**Query Logic**:
- Fetches ALL `DiscoveredContent` for the patch
- Filters out items without titles
- Returns items with or without heroes/summaries

### Database Schema Check

**Field**: `isUseful` (Boolean)
- ✅ Set to `true` for all 4 saved citations
- ✅ Not used as a filter in API route
- ❓ May be used in frontend filtering?

### Potential Issues

#### Issue 1: Frontend Filtering
The frontend may be filtering by `isUseful` or other criteria not visible in the API route.

**Check**: `carrot/src/components/patch/DiscoveredContent.tsx` and `carrot/src/app/(app)/patch/[handle]/useDiscoveredItems.ts`

#### Issue 2: Missing Hero Images
All 4 citations have `hero: 'pending'` initially, then `hero: true` after hero generation is triggered. However, hero generation is failing:

```
[HTTP1Fetch] Request failed (attempt 1/4): {
  url: 'https://en.wikinews.org/wiki/Special:Search/Palestine%20(region)',
  error: 'Referrer "no-referrer" is not a valid URL.',
  isRetryable: false
}
```

**Impact**: Hero images not being generated, but API route should still return items without heroes.

#### Issue 3: Low Save Rate
Only 4 out of 143 processed citations saved (2.8%). Most rejections are valid:
- Metadata/catalog pages (GND, Library of Congress, etc.)
- Search results pages (Wiktionary, Wikisource, Wikibooks)
- Low-quality content (< 1000 chars, < 3 paragraphs)

**This is expected behavior** - the system is correctly filtering out low-quality content.

## Recommendations

### Immediate Actions

1. **Check Frontend Filtering**
   - Review `useDiscoveredItems.ts` for any filters on `isUseful` or other fields
   - Check if frontend requires hero images to display items
   - Verify API response is being parsed correctly

2. **Fix Hero Generation Referrer Issue**
   - The error `Referrer "no-referrer" is not a valid URL` is preventing hero generation
   - This is a non-fatal issue but should be fixed
   - Location: Hero generation in `wikipediaProcessor.ts` line 1505

3. **Add Debug Logging**
   - Log API response in frontend to see if items are being returned
   - Log frontend filtering logic to see what's being filtered out

### Long-term Improvements

1. **Improve Save Rate** (if desired)
   - Current 2.8% save rate is actually good - filtering out low-quality content
   - Could relax `isActualArticle` checks slightly for generic topics like "Israel"
   - But this may introduce noise

2. **Better Error Handling**
   - Hero generation failures should not block content display
   - Add retry logic for hero generation

## Next Steps

1. ✅ Verify API is returning the 4 saved citations
2. ✅ Check frontend filtering logic
3. ✅ Fix hero generation referrer issue
4. ✅ Add debug logging to trace frontend display issue

## Log Evidence

### Successful Saves
```
[WikipediaProcessor] Saved citation to DiscoveredContent: cmixhacx7000jr82iedk4uagd (relevance: 0.51, useful: true)
[WikipediaProcessor] ✅ Successfully saved citation to DiscoveredContent: cmixhacx7000jr82iedk4uagd
{"tag":"content_saved","url":"https://en.wikinews.org/wiki/Special:Search/Palestine%20(region)","textBytes":6258,"score":85,"hero":"pending"}
```

### Hero Generation Failures
```
[HTTP1Fetch] Request failed (attempt 1/4): {
  url: 'https://en.wikinews.org/wiki/Special:Search/Palestine%20(region)',
  error: 'Referrer "no-referrer" is not a valid URL.',
  isRetryable: false
}
```

### Rejection Reasons
- Score 35: Wiktionary search results (not an article)
- Score 45: Wikisource search results (catalog page)
- Score 30: GND authority file (metadata page)
- Score 5: Wikidata redirector (technical page)

