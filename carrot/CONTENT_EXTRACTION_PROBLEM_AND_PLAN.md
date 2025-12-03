# Content Extraction Problem & Fix Plan

## Problem Analysis

### Current Flow (Why Nothing is Being Saved)

1. **Citation Extraction** ✅ Working
   - Citations are extracted from Wikipedia pages
   - Stored in `wikipediaCitation` table
   - 8,827 citations stored for Israel patch

2. **Citation Processing** ⚠️ Partially Working
   - Citations are fetched from database
   - URLs are verified (HEAD request)
   - Content is fetched (GET request)

3. **Content Extraction** ❌ **BROKEN - This is the main problem**
   - **Current method (line 860-867):**
     ```typescript
     const textContent = html
       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
       .replace(/<[^>]+>/g, ' ')
       .replace(/\s+/g, ' ')
       .trim()
     ```
   - **Problem:** This is extremely basic - just strips all HTML tags
   - **Result:** Extracts ALL text from the page including:
     - Navigation menus
     - Sidebars
     - Footer links
     - Cookie notices
     - Advertisements
     - JavaScript-generated content (as text)
     - Comments
   - **Actual result:** Very short, fragmented content (46-404 chars)
   - **Example:** A 5000-word article might extract to 200 chars of navigation text

4. **Content Validation** ❌ **Failing Due to Poor Extraction**
   - **Phase 1 Check (line 870):** Requires 500 chars minimum
   - **Phase 2 Check (line 85):** `isActualArticle()` requires:
     - ≥ 1000 chars
     - ≥ 3 paragraphs (detected by `\n\n`)
     - Narrative structure (sentences with proper capitalization)
   - **Result:** Most citations fail here because extracted content is too short
   - **Current stats:** 149 scanned, 0 saved (all denied before AI scoring)

5. **AI Scoring** ❌ **Never Reached**
   - Content never reaches `scoreCitationContent()` because it fails validation
   - DeepSeek never gets a chance to evaluate relevance
   - No AI scores generated

6. **Saving** ❌ **Never Happens**
   - `saveAsContent()` is never called because `finalIsRelevant` is always false
   - Result: 0 items saved despite 149 citations scanned

### Root Cause

**The content extraction method is too primitive.** It doesn't:
- Identify the main article content area
- Remove boilerplate (navigation, ads, footers)
- Extract structured content (paragraphs, headings)
- Handle modern web pages with complex layouts

### Evidence

From logs and database:
- **149 citations scanned** - URLs were fetched successfully
- **0 saved** - All failed content validation
- **Content lengths:** 46-404 chars (should be 1000+ for articles)
- **All denied** - Never reached AI scoring phase

## Solution Plan

### Option 1: Use Existing ContentExtractor (Recommended)

We already have a better content extractor in `carrot/src/lib/discovery/content-quality.ts`:
- Has `removeBoilerplate()` method
- Extracts title, text, metadata
- Generates summaries
- More sophisticated than current method

**Implementation:**
1. Replace simple HTML stripping with `ContentExtractor.extractFromHtml()`
2. Use extracted `text` field instead of raw HTML stripping
3. Keep existing validation logic (it's fine, just needs better input)

**Pros:**
- Already exists in codebase
- More sophisticated extraction
- Handles boilerplate removal
- Extracts structured content

**Cons:**
- May need to adjust for our use case
- Need to verify it works well for various sites

### Option 2: Use Readability-based Extraction

We have `extractReadableContent()` in `carrot/src/lib/readability.ts`:
- Tries to find main content areas (`<article>`, `<main>`, content divs)
- Falls back to body content
- Extracts metadata

**Implementation:**
1. Use `extractReadableContent()` instead of simple stripping
2. Use the extracted text content
3. Keep validation logic

**Pros:**
- Simpler than ContentExtractor
- Focused on main content extraction
- Already in codebase

**Cons:**
- Less sophisticated than ContentExtractor
- May not handle all site types well

### Option 3: Use JSDOM-based Extraction

We have `ContentExtractor` in `carrot/src/lib/ai-agents/contentExtractor.ts`:
- Uses JSDOM for proper DOM parsing
- Extracts title, content, author, published date
- More robust HTML parsing

**Implementation:**
1. Use `ContentExtractor.extractFromHtml()` or `extractFromUrl()`
2. Use extracted content
3. Keep validation logic

**Pros:**
- Proper DOM parsing (not regex-based)
- Extracts structured data
- Handles complex HTML

**Cons:**
- Requires JSDOM (may have dependencies)
- More complex

### Recommended Approach: Hybrid Solution

**Phase 1: Quick Fix - Use Readability Extraction**
1. Replace simple HTML stripping with `extractReadableContent()`
2. This should immediately improve content extraction
3. Test with existing citations

**Phase 2: Enhanced Extraction - Use ContentExtractor**
1. If readability isn't sufficient, upgrade to `ContentExtractor.extractFromHtml()`
2. This provides better boilerplate removal
3. Better handling of modern web pages

**Phase 3: Validation Adjustments (if needed)**
1. After better extraction, review validation thresholds
2. May need to adjust `isActualArticle()` checks
3. Ensure we're not too strict for legitimate short articles

## Implementation Details

### Changes Needed

**File: `carrot/src/lib/discovery/wikipediaProcessor.ts`**

**Current code (lines 860-867):**
```typescript
// Extract text content (simplified - could use better extraction)
const textContent = html
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 50000)
```

**Replace with:**
```typescript
// Use proper content extraction to get main article content
const { extractReadableContent } = await import('@/lib/readability')
const extracted = extractReadableContent(html, citationUrl)
const textContent = extracted.content || extracted.text || ''
```

**Or (better option):**
```typescript
// Use ContentExtractor for better boilerplate removal
const { ContentExtractor } = await import('./content-quality')
const extracted = await ContentExtractor.extractFromHtml(html, citationUrl)
const textContent = extracted.text || ''
```

### Validation Flow (Keep As-Is)

The validation logic is fine - it just needs better input:
1. **Minimum length check (500 chars)** - Reasonable
2. **Article validation (1000 chars, 3+ paragraphs)** - Reasonable for articles
3. **AI scoring (DeepSeek)** - Will work once content is properly extracted
4. **Relevance threshold (60)** - Appropriate

### Expected Results

After fix:
- **Content extraction:** Should get 1000-5000+ chars for real articles
- **Validation:** Most articles should pass `isActualArticle()` check
- **AI scoring:** Content will reach DeepSeek for relevance evaluation
- **Saving:** Relevant articles (score >= 60) will be saved to `DiscoveredContent`

## Testing Plan

1. **Test with existing citations:**
   - Re-process some denied citations
   - Verify content extraction is better
   - Check if they pass validation

2. **Monitor metrics:**
   - Track content length distribution
   - Track validation pass rate
   - Track AI scoring results
   - Track save rate

3. **Edge cases:**
   - Test with different site types (news, blogs, academic)
   - Test with paywalled content
   - Test with JavaScript-heavy sites
   - Test with PDFs (if applicable)

## Rollout Plan

1. **Implement Phase 1 (Readability extraction)**
   - Quick fix, immediate improvement
   - Low risk

2. **Test and monitor**
   - Run on subset of citations
   - Compare before/after metrics

3. **Upgrade to Phase 2 if needed**
   - If readability isn't sufficient
   - Use ContentExtractor for better results

4. **Adjust validation if needed**
   - After seeing real content lengths
   - May need to adjust thresholds

## Questions for Review

1. **Which extraction method do you prefer?**
   - Readability (simpler, quick fix)
   - ContentExtractor (more sophisticated)
   - JSDOM-based (most robust)

2. **Should we adjust validation thresholds?**
   - Current: 1000 chars, 3 paragraphs
   - Some legitimate articles might be shorter

3. **Should we re-process denied citations?**
   - Many were denied due to poor extraction
   - Could re-process with better extraction

4. **Error handling:**
   - What should we do if extraction fails?
   - Fallback to simple method?
   - Mark as error and continue?

