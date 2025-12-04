# External URL Extraction Fixes - TODO List

## Executive Summary

**Problem**: Only 15 external URLs extracted from Zionism page (1,236 total citations), but audit shows 1,273 external URLs should exist. The extraction function `extractWikipediaCitationsWithContext` only extracts from the References section, missing URLs from Further reading and External links sections.

**Root Cause**: 
1. `extractWikipediaCitationsWithContext` only extracts from References section
2. `WikipediaSource.extractCitations` extracts from References + External links, but if it fails/returns empty, we fall back to `extractWikipediaCitationsWithContext` which misses External links
3. Further reading section is never extracted by either method
4. Audit function `extractAllExternalUrls` includes Wikipedia internal links in count

---

## Priority 1: Critical Fixes (Blocking External URL Extraction)

### Fix 1: Update extractWikipediaCitationsWithContext to Extract from ALL Sections ⚠️ CRITICAL

**Problem**: `extractWikipediaCitationsWithContext` only extracts from References section, missing Further reading and External links sections.

**Current Code** (wikiUtils.ts:259-341):
```typescript
export function extractWikipediaCitationsWithContext(
  html: string | undefined,
  sourceUrl: string,
  limit = 100
): WikipediaCitation[] {
  // Only extracts from References section
  const referencesMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  // ... only processes References section
}
```

**Solution**: Add extraction from Further reading and External links sections, similar to `extractAllExternalUrls`.

**Implementation**:
```typescript
export function extractWikipediaCitationsWithContext(
  html: string | undefined,
  sourceUrl: string,
  limit = 10000
): WikipediaCitation[] {
  if (!html) return []
  
  const citations: WikipediaCitation[] = []
  const seenUrls = new Set<string>()
  
  // Helper function to add citation (with Wikipedia filtering)
  function addCitation(url: string, title?: string, context?: string, section?: string) {
    // Skip relative Wikipedia links (./, /wiki/)
    if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
      return // Skip Wikipedia internal links
    }
    
    // Skip if it's already a Wikipedia URL
    if (url.includes('wikipedia.org/wiki/') || url.includes('wikipedia.org/w/')) {
      return
    }
    
    const normalized = normaliseUrl(url, sourceUrl)
    if (!normalized) return
    
    // Double-check: skip if normalized URL is a Wikipedia URL
    if (normalized.includes('wikipedia.org/wiki/') || normalized.includes('wikipedia.org/w/')) {
      return
    }
    
    const canonical = canonicalizeUrlFast(normalized)
    if (!canonical) return
    
    // Triple-check: skip if canonical URL is a Wikipedia URL
    if (canonical.includes('wikipedia.org/wiki/') || canonical.includes('wikipedia.org/w/')) {
      return
    }
    
    if (!seenUrls.has(canonical)) {
      seenUrls.add(canonical)
      citations.push({
        url: canonical,
        title,
        context: context ? context.substring(0, 500) : undefined,
        text: context || title
      })
    }
  }
  
  // 1. Extract from References section (existing logic)
  const referencesMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  if (referencesMatch) {
    const refsHtml = referencesMatch[1]
    const refMatches = refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi)
    
    for (const refMatch of refMatches) {
      if (citations.length >= limit) break
      
      const index = parseInt(refMatch[1])
      const refHtml = refMatch[2]
      
      // Extract reference text
      const textMatch = refHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
      if (!textMatch) continue
      
      const refText = textMatch[1]
      
      // Extract URL from external links
      const urlMatch = refText.match(/<a[^>]*class=["'][^"']*external[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
                      refText.match(/href=["'](https?:\/\/[^"']+)["']/i)
      const url = urlMatch ? urlMatch[1] : undefined
      
      if (!url) continue
      
      // Extract title
      const titleMatch = refText.match(/title=["']([^"']+)["']/i) || 
                        refText.match(/<cite[^>]*>([^<]+)<\/cite>/i)
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : undefined
      
      // Clean context text
      const context = refText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      
      addCitation(url, title, context, 'References')
    }
  }
  
  // 2. Extract from Further reading section (NEW)
  const furtherReadingMatch = html.match(/<h2[^>]*>.*?Further\s+reading.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (furtherReadingMatch) {
    const sectionHtml = furtherReadingMatch[1]
    const linkMatches = sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    for (const linkMatch of linkMatches) {
      if (citations.length >= limit) break
      
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      
      // Only include http/https URLs (skip relative Wikipedia links)
      if (url.startsWith('http') || url.startsWith('//')) {
        addCitation(url, linkText, undefined, 'Further reading')
      }
    }
  }
  
  // 3. Extract from External links section (NEW)
  const externalLinksMatch = html.match(/<h2[^>]*>.*?External\s+links.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (externalLinksMatch) {
    const sectionHtml = externalLinksMatch[1]
    const linkMatches = sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    for (const linkMatch of linkMatches) {
      if (citations.length >= limit) break
      
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      
      // Only include http/https URLs (skip relative Wikipedia links)
      if (url.startsWith('http') || url.startsWith('//')) {
        addCitation(url, linkText, undefined, 'External links')
      }
    }
  }
  
  return citations
}
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikiUtils.ts` (function `extractWikipediaCitationsWithContext`)

**Testing**:
- Run extraction on Zionism page
- Verify URLs from Further reading and External links sections are now captured
- Check database to confirm count increased

---

### Fix 2: Fix extractAllExternalUrls to Filter Wikipedia Internal Links

**Problem**: `extractAllExternalUrls` includes Wikipedia internal links in its count, causing audit to show inflated numbers.

**Current Code** (wikiUtils.ts:108-254):
```typescript
export function extractAllExternalUrls(
  html: string | undefined,
  sourceUrl: string
): WikipediaCitation[] {
  // Includes Wikipedia links in addCitation() - should filter them
  function addCitation(url: string, title?: string, context?: string, section?: string) {
    // Converts relative Wikipedia links to absolute, but doesn't filter them
    if (url.startsWith('./')) {
      normalizedUrl = `https://en.wikipedia.org/wiki/${pageName}` // Should skip this!
    }
  }
}
```

**Solution**: Filter out Wikipedia URLs in `addCitation` function, similar to `extractWikipediaCitationsWithContext`.

**Implementation**:
```typescript
function addCitation(url: string, title?: string, context?: string, section?: string) {
  // Skip relative Wikipedia links (./, /wiki/)
  if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
    return // Skip Wikipedia internal links
  }
  
  let normalizedUrl = url
  if (url.startsWith('http') || url.startsWith('//')) {
    // Already absolute URL - normalize it
    const normalised = normaliseUrl(url, sourceUrl)
    if (!normalised) return
    normalizedUrl = normalised
  } else {
    // Not a valid URL format
    return
  }
  
  // Skip if it's a Wikipedia URL
  if (isWikipediaUrl(normalizedUrl)) {
    return
  }
  
  const canonical = canonicalizeUrlFast(normalizedUrl)
  if (!canonical) return
  
  // Double-check: skip if canonical URL is a Wikipedia URL
  if (isWikipediaUrl(canonical)) {
    return
  }
  
  if (seenUrls.has(canonical)) return
  
  seenUrls.add(canonical)
  citations.push({
    url: canonical,
    title: title || undefined,
    context: context || section || undefined,
    text: title || context || section
  })
}
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikiUtils.ts` (function `extractAllExternalUrls`)

**Testing**:
- Run self-audit on Zionism page
- Verify external URL count matches database count (excluding Wikipedia internal)

---

### Fix 3: Investigate Why WikipediaSource.getPage() Citations Are Empty

**Problem**: If `WikipediaSource.getPage()` returns empty citations, we fall back to `extractWikipediaCitationsWithContext` which misses External links section.

**Investigation Steps**:
1. Add logging to `WikipediaSource.getPage()` to track:
   - How many citations found by `extractCitations()`
   - Which sections were found (References, External links)
   - Why citations might be empty

2. Check if REST API HTML format differs from regular HTML format
3. Verify `extractCitations()` regex patterns match REST API HTML structure

**Files to Check**:
- `carrot/src/lib/discovery/wikipediaSource.ts` (function `extractCitations`)
- `carrot/src/lib/discovery/wikipediaProcessor.ts` (function `processNextWikipediaPage`)

**Solution**:
- Ensure `WikipediaSource.extractCitations()` properly extracts from External links section
- If REST API HTML format is different, update regex patterns
- Add fallback to always use `extractWikipediaCitationsWithContext` with full section support

---

## Priority 2: High Priority (Improve Extraction Quality)

### Fix 4: Add Logging to Track Extraction Method and Section Counts

**Problem**: No visibility into which extraction method is used and how many URLs found per section.

**Solution**: Add structured logging:
```typescript
console.info(JSON.stringify({
  tag: 'citation_extraction',
  wikipediaPage: pageTitle,
  method: 'WikipediaSource' | 'extractWikipediaCitationsWithContext',
  sections: {
    references: count,
    furtherReading: count,
    externalLinks: count
  },
  totalFound: count,
  totalStored: count
}))
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaSource.ts`
- `carrot/src/lib/discovery/wikiUtils.ts`
- `carrot/src/lib/discovery/wikipediaProcessor.ts`

---

### Fix 5: Add Validation to Ensure All Sections Are Extracted

**Problem**: No validation that extraction captured URLs from all expected sections.

**Solution**: Add validation function that checks:
- References section was found and processed
- External links section was found and processed (if exists)
- Further reading section was found and processed (if exists)
- Minimum expected external URLs found (warn if too few)

**Files to Create**:
- `carrot/src/lib/discovery/extractionValidator.ts`

---

## Priority 3: Medium Priority (Backfill and Testing)

### Fix 6: Backfill Existing Wikipedia Pages to Re-extract Citations

**Problem**: Existing Wikipedia pages were extracted with old logic, missing URLs from Further reading and External links sections.

**Solution**: Create backfill script to:
1. Find all Wikipedia pages in monitoring
2. Re-fetch HTML
3. Re-extract citations using updated `extractWikipediaCitationsWithContext`
4. Add new citations to database (skip duplicates)

**Files to Create**:
- `carrot/scripts/backfill-wikipedia-citations.ts`

**Usage**:
```bash
npx tsx scripts/backfill-wikipedia-citations.ts --patch=israel --limit=10
```

---

### Fix 7: Test Extraction on Zionism Page

**Problem**: Need to verify fixes work on actual data.

**Solution**: 
1. Apply Fix 1 (update `extractWikipediaCitationsWithContext`)
2. Re-extract citations from Zionism page
3. Verify count increased from 15 to expected number
4. Run self-audit to verify coverage

---

### Fix 8: Investigate Why 15 Verified URLs Were Not Saved

**Problem**: 15 external URLs were verified but 0 were saved to DiscoveredContent.

**Investigation Steps**:
1. Query database for the 15 verified URLs
2. Check their `aiPriorityScore` values
3. Check their `contentText` lengths
4. Check their `relevanceDecision` values
5. Review logs for `ai_score` and `content_saved` entries

**Possible Causes**:
- AI scores below 60 threshold
- Content too short (< 600 chars for AI scoring, < 500 chars for validation)
- `saveAsContent` function not being called
- Database errors during save

**Files to Check**:
- Database queries for verified citations
- Logs for processing these citations
- `wikipediaProcessor.ts` save logic

---

## Priority 4: Low Priority (Optimization)

### Fix 9: Update Self-Audit to Properly Filter Wikipedia Internal Links

**Problem**: Self-audit includes Wikipedia internal links in external URL count.

**Solution**: Apply Fix 2 (filter Wikipedia links in `extractAllExternalUrls`), then audit will be accurate.

**Files to Modify**:
- `carrot/src/lib/discovery/wikiUtils.ts` (already covered in Fix 2)

---

### Fix 10: Add Extraction Metrics Dashboard

**Problem**: No visibility into extraction performance across sections.

**Solution**: Create dashboard showing:
- URLs extracted per section (References, Further reading, External links)
- Extraction method used per page
- Coverage rate (extracted vs. expected)

**Files to Create**:
- `carrot/src/app/api/test/extraction/metrics/route.ts`
- Update extraction test page to show metrics

---

## Implementation Order

1. **Fix 1**: Update `extractWikipediaCitationsWithContext` (unblocks extraction)
2. **Fix 2**: Fix `extractAllExternalUrls` filtering (fixes audit accuracy)
3. **Fix 3**: Investigate `WikipediaSource.getPage()` (ensures primary path works)
4. **Fix 4**: Add logging (visibility)
5. **Fix 6**: Backfill existing pages (recover missing URLs)
6. **Fix 7**: Test on Zionism page (verify fixes)
7. **Fix 8**: Investigate why verified URLs weren't saved (fix save pipeline)
8. **Fix 5**: Add validation (prevent regressions)
9. **Fix 9**: Update audit (already covered in Fix 2)
10. **Fix 10**: Add metrics dashboard (nice to have)

---

## Success Criteria

After implementing fixes:
- ✅ Zionism page should have 200+ external URLs in database (not just 15)
- ✅ Self-audit should show >95% coverage (found in DB / total external URLs)
- ✅ URLs from Further reading and External links sections are captured
- ✅ No Wikipedia internal links in external URL count
- ✅ Verified URLs are being saved to DiscoveredContent
- ✅ Structured logs show extraction from all sections

---

## Testing Checklist

- [ ] Run extraction on Zionism page
- [ ] Verify URLs from all sections are captured
- [ ] Check database count increased
- [ ] Run self-audit - verify coverage >95%
- [ ] Check logs for `citation_extraction` entries
- [ ] Verify verified URLs are being saved
- [ ] Run backfill on existing pages
- [ ] Verify no Wikipedia internal links in external count

