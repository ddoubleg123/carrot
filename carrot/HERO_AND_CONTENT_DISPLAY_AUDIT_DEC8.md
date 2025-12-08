# Hero Image and Content Display Audit - December 8, 2025

## Executive Summary

**Status**: 🔴 **CRITICAL ISSUES IDENTIFIED**

The discovery process is successfully saving content (7 citations saved with scores 85-95), but **hero images are completely failing** and **content detail pages are missing critical data**. Users see placeholder gradients instead of hero images, and clicking on content shows empty "FACTS & RECEIPTS" sections.

---

## Issues Identified

### 1. 🔴 Hero Image Fetch Failures (CRITICAL)

**Problem**: All hero image fetches are timing out after 4 retries (18+ seconds).

**Evidence from Logs**:
```
[HTTP1Fetch] Request failed (attempt 1/4): { url: 'https://en.wiktionary.org/wiki/Zionism', error: 'fetch failed' }
[HTTP1Fetch] Request failed (attempt 2/4): { url: 'https://en.wikiquote.org/wiki/Zionism', error: 'fetch failed' }
[HTTP1Fetch] Request failed (attempt 3/4): { url: 'https://en.wikisource.org/wiki/Portal:Zionism', error: 'fetch failed' }
[HTTP1Fetch] Request failed (attempt 4/4): { url: 'https://islamansiklopedisi.org.tr/siyonizm', error: 'This operation was aborted' }
{"ts":1765228701496,"stage":"fetch","status":"error","errorCode":"TIMEOUT","errorMessage":"This operation was aborted"}
```

**Affected URLs**:
- `https://en.wiktionary.org/wiki/Zionism` - Timeout after 18s
- `https://en.wikiquote.org/wiki/Zionism` - Timeout after 18s
- `https://en.wikisource.org/wiki/Portal:Zionism` - Timeout after 18s
- `https://islamansiklopedisi.org.tr/siyonizm` - Timeout after 18s
- `http://zionistarchives.org.il/en` - Timeout after 17s
- `https://wzo.org.il/en` - Timeout after 18s
- `http://encyclopediaofukraine.com/display.asp?linkpath=pages\Z\I\Zionistmovement` - Timeout after 17s

**Root Causes**:
1. **Network/Blocking**: These domains may be blocking Render.com IPs or requiring specific headers
2. **Timeout Too Short**: 18s timeout may be insufficient for slow sites
3. **URL Normalization**: Some URLs may need www prefix or protocol fixes (we added this but may need more)
4. **Connection Pool Issues**: HTTP1Fetch connection pool may be exhausted

**Impact**: 
- Hero images marked as `"hero": true` but no actual image URL stored
- Frontend shows gradient placeholders instead of images
- User experience severely degraded

---

### 2. 🔴 Hero Image URL Storage (CRITICAL)

**Problem**: Hero images are marked as `"hero": "pending"` then `"hero": true`, but actual image URLs are not being stored in the database.

**Evidence from Logs**:
```json
{"tag":"content_saved","url":"https://en.wiktionary.org/wiki/Zionism","textBytes":9232,"score":85,"hero":"pending"}
{"tag":"content_saved","url":"https://en.wikiquote.org/wiki/Zionism","textBytes":39722,"score":95,"hero":true}
```

**Expected Behavior**:
- Hero image URL should be stored in `Hero` table (`imageUrl` field)
- Or stored in `DiscoveredContent.hero` JSON field as `{ url: "...", source: "..." }`
- Frontend should retrieve from `heroRelation.imageUrl` or `heroJson.url`

**Current State**:
- Hero generation is triggered (`"hero": "pending"` → `"hero": true`)
- But fetch fails, so no URL is stored
- Frontend has no image URL to display

**Root Causes**:
1. **Enrichment Worker Failing**: Hero enrichment is failing silently
2. **No Fallback Generation**: When fetch fails, no AI-generated fallback is created
3. **Database Update Missing**: Hero URL not being saved even if generated

---

### 3. 🟡 Summarization Contract Validation Failures

**Problem**: DeepSeek summarization API is returning incomplete data, causing contract validation failures.

**Evidence from Logs**:
```
[summarize-content] Contract validation failed, filling defaults: [
  'title: Required',
  'keyFacts: Array must contain at least 3 element(s)',
  'isUseful: Required'
]
```

**Impact**:
- `keyFacts` array has fewer than 3 items (required minimum)
- `title` field is missing
- `isUseful` boolean is missing
- Frontend "FACTS & RECEIPTS" section appears empty

**Root Causes**:
1. **DeepSeek Response Incomplete**: API may be returning partial data
2. **Response Parsing Error**: JSON parsing may be failing
3. **No Validation Fallbacks**: Contract validation fills defaults but doesn't retry or log the actual response

---

### 4. 🟡 Empty "FACTS & RECEIPTS" Section

**Problem**: When clicking on a discovered content card, the detail page shows empty "FACTS & RECEIPTS" section.

**Evidence from Image**:
- Detail page for "İslâm Ansiklopedisi" shows empty "FACTS & RECEIPTS" section
- Only "Source 1" appears in "PROVENANCE" section

**Expected Behavior**:
- Facts array should contain 3-6 facts from DeepSeek synthesis
- Each fact should have label, value, and citation
- Quotes should appear if available

**Root Causes**:
1. **Facts Not Stored**: DeepSeek synthesis may not be saving facts to database
2. **API Response Missing**: Facts may not be included in API response
3. **Frontend Mapping Error**: Frontend may not be correctly extracting facts from response

---

### 5. 🟡 Content Detail Page URL Missing

**Problem**: Each discovered content item should have its own unique URL, but cards may not be linking correctly.

**Expected Behavior**:
- Each item should have URL like `/patch/israel/content/[slug]`
- `urlSlug` should be generated and stored in `metadata.urlSlug`
- Cards should link to detail pages on click

**Current State**:
- Need to verify `urlSlug` generation in `wikipediaProcessor.ts`
- Need to verify `ContentPage` component exists and routes correctly
- Need to verify cards link to detail pages

---

### 6. 🟡 Hero Image Text Content Missing

**Problem**: Hero images should display text overlay or have associated text content.

**Expected Behavior**:
- Hero images should have title/summary overlay
- Or hero section in detail page should include text content alongside image
- Text should be from DeepSeek cleaned data

**Current State**:
- Hero images are just images with no text
- Need to add text overlay or ensure hero section includes text

---

## Data Flow Analysis

### Current Flow (Broken)

```
1. WikipediaProcessor saves citation → DiscoveredContent created
2. Hero generation triggered → "hero": "pending"
3. Enrichment worker called → Fetches URL for hero image
4. ❌ Fetch fails (timeout after 18s)
5. Hero marked as "hero": true but no URL stored
6. Frontend requests content → No hero URL in response
7. Frontend shows gradient placeholder
```

### Expected Flow (Fixed)

```
1. WikipediaProcessor saves citation → DiscoveredContent created
2. Hero generation triggered → "hero": "pending"
3. Enrichment worker called → Fetches URL for hero image
4a. ✅ Fetch succeeds → Hero URL stored in Hero table
4b. ❌ Fetch fails → AI-generated fallback created → Hero URL stored
5. Frontend requests content → Hero URL in mediaAssets.hero
6. Frontend displays hero image
```

---

## Root Cause Analysis

### Primary Issues

1. **Network/Timeout Issues**: 
   - Render.com may be blocked by some domains
   - 18s timeout may be too short for slow sites
   - Connection pool may be exhausted

2. **No Fallback Strategy**:
   - When hero fetch fails, no AI-generated fallback is created
   - System marks hero as "true" but stores no URL
   - Frontend has nothing to display

3. **Data Storage Gaps**:
   - Hero URLs not being saved to database when fetch fails
   - DeepSeek synthesis data may not be fully stored
   - Facts/quotes may not be properly saved

4. **API Response Gaps**:
   - Summarization API returning incomplete data
   - Contract validation failing but not retrying
   - Frontend receiving incomplete data

---

## Fix Plan

### Phase 1: Fix Hero Image Fetching (HIGH PRIORITY)

1. **Increase Timeout**: Increase hero fetch timeout from 18s to 30s
2. **Add Retry Logic**: Implement exponential backoff with more retries
3. **Add Fallback Generation**: When fetch fails, generate AI hero image as fallback
4. **Fix URL Normalization**: Ensure all URLs are properly normalized (www, protocol)
5. **Add Connection Pooling**: Improve HTTP1Fetch connection pool management

### Phase 2: Fix Hero Image Storage (HIGH PRIORITY)

1. **Ensure URL Storage**: Always save hero URL to Hero table, even if fetch fails (use fallback)
2. **Update DiscoveredContent**: Update `hero` JSON field with URL and source
3. **Verify API Response**: Ensure API returns `mediaAssets.hero` with actual URL
4. **Frontend Verification**: Verify `pickHero()` correctly extracts hero URL

### Phase 3: Fix Summarization Data (MEDIUM PRIORITY)

1. **Fix Contract Validation**: Ensure DeepSeek response includes all required fields
2. **Add Fallbacks**: If response incomplete, generate fallback data
3. **Retry Logic**: Retry summarization if contract validation fails
4. **Logging**: Add detailed logging of DeepSeek responses

### Phase 4: Fix Content Display (MEDIUM PRIORITY)

1. **Store Facts/Quotes**: Ensure DeepSeek synthesis saves facts/quotes to database
2. **API Response**: Include facts/quotes in API response
3. **Frontend Mapping**: Verify frontend correctly maps facts/quotes
4. **Detail Page**: Ensure detail page displays all content

### Phase 5: Fix Detail Page URLs (LOW PRIORITY)

1. **Generate URL Slugs**: Ensure `urlSlug` is generated and stored
2. **Content Page Route**: Verify `/patch/[handle]/content/[slug]` route works
3. **Card Links**: Ensure cards link to detail pages

### Phase 6: Add Hero Text Content (LOW PRIORITY)

1. **Text Overlay**: Add title/summary overlay on hero images
2. **Hero Section**: Ensure hero section in detail page includes text
3. **DeepSeek Data**: Use DeepSeek cleaned data for text content

---

## Testing Plan

### Test Cases

1. **Hero Image Fetch**:
   - ✅ Test successful fetch (wikimedia.org)
   - ✅ Test failed fetch with fallback (blocked domain)
   - ✅ Test timeout handling
   - ✅ Verify URL stored in database

2. **Frontend Display**:
   - ✅ Verify hero images appear on cards
   - ✅ Verify gradient placeholder when no hero
   - ✅ Verify hero images in detail pages

3. **Content Data**:
   - ✅ Verify facts/quotes appear in detail pages
   - ✅ Verify "FACTS & RECEIPTS" section populated
   - ✅ Verify DeepSeek data is displayed

4. **Detail Page URLs**:
   - ✅ Verify each item has unique URL
   - ✅ Verify cards link to detail pages
   - ✅ Verify detail pages load correctly

---

## Metrics to Track

1. **Hero Image Success Rate**: % of items with hero images
2. **Hero Fetch Time**: Average time to fetch hero image
3. **Fallback Generation Rate**: % of heroes using AI fallback
4. **Content Completeness**: % of items with facts/quotes
5. **Detail Page Views**: Number of detail page views

---

## Next Steps

1. **Immediate**: Fix hero image fetching and storage (Phases 1-2)
2. **Short-term**: Fix summarization and content display (Phases 3-4)
3. **Long-term**: Add detail page URLs and hero text (Phases 5-6)

---

## Files to Modify

### Hero Image Fixes
- `carrot/src/lib/http1Fetch.ts` - Increase timeout, improve retry logic
- `carrot/src/lib/enrichment/worker.ts` - Add fallback generation
- `carrot/src/lib/enrichment/imageFallback.ts` - Improve fallback logic
- `carrot/src/lib/discovery/hero-pipeline.ts` - Ensure URL storage

### Content Display Fixes
- `carrot/src/lib/discovery/wikipediaProcessor.ts` - Ensure facts/quotes stored
- `carrot/src/app/api/ai/summarize-content/route.ts` - Fix contract validation
- `carrot/src/app/api/patches/[handle]/discovered-content/route.ts` - Include all fields
- `carrot/src/app/(app)/patch/[handle]/useDiscoveredItems.ts` - Fix frontend mapping

### Detail Page Fixes
- `carrot/src/app/(app)/patch/[handle]/content/[slug]/page.tsx` - Verify route
- `carrot/src/app/(app)/patch/[handle]/components/DiscoveryCard.tsx` - Add links
- `carrot/src/components/modal/UnifiedContentModal.tsx` - Display all content

---

## Conclusion

The discovery process is **working correctly** for finding and saving content, but **hero images are completely broken** and **content detail pages are missing critical data**. The primary issues are:

1. Hero image fetches timing out (network/blocking issues)
2. No fallback generation when fetch fails
3. Hero URLs not being stored in database
4. Summarization data incomplete (contract validation failures)
5. Facts/quotes not appearing in detail pages

**Priority**: Fix hero images first (Phases 1-2), then content display (Phases 3-4), then detail pages (Phases 5-6).

