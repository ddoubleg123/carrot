# Wikipedia Processing - Comprehensive Review & Missing Pieces

## Executive Summary

After full analysis, here's what's working, what's missing, and what needs to be fixed before the system is production-ready.

## ✅ What's Working

1. **Wikipedia Monitoring**: Pages are being monitored and citations extracted (7,874 citations)
2. **DeepSeek Scoring**: 7,655 citations scored (97% coverage)
3. **Content Storage**: 1,309 citations saved to DiscoveredContent, 1,995 to AgentMemory
4. **Hero Image Triggering**: Hero enrichment API is being called (`/api/internal/enrich/[id]`)
5. **Agent Memory**: Memories are being created and stored correctly
6. **KPIs**: All metrics are updating correctly

## ❌ Critical Missing Pieces

### 1. **URL Quality Filtering** (CRITICAL)

**Problem**: We're processing and scoring low-quality URLs:
- Library catalogs (VIAF, LOC, NDL, etc.)
- Authority files (id.loc.gov, viaf.org, etc.)
- Metadata pages (Yale LUX, etc.)
- Wikipedia internal links (relative URLs)

**Impact**: 
- Wasting API calls on non-articles
- Cluttering DiscoveredContent with useless entries
- DeepSeek scoring metadata pages as "relevant" (score 50) when they're not

**Current State**: 
- No filtering for library/authority URLs
- Wikipedia internal links are converted but still processed
- All URLs go through DeepSeek scoring

**What's Needed**:
```typescript
// Filter out low-quality URLs BEFORE processing
const LOW_QUALITY_DOMAINS = [
  'viaf.org',
  'id.loc.gov',
  'id.ndl.go.jp',
  'nli.org.il',
  'collections.yale.edu',
  'web.archive.org', // Unless specifically needed
  'commons.wikimedia.org', // Unless specifically needed
]

const LOW_QUALITY_PATTERNS = [
  /\/authorities\//,
  /\/viaf\//,
  /\/auth\//,
  /\/catalog\//,
]
```

### 2. **Content Type Detection** (CRITICAL)

**Problem**: We're not detecting if content is:
- An actual article (good)
- A metadata/catalog page (bad)
- A redirect page (bad)
- An error page (bad)

**Impact**: 
- DeepSeek scores metadata pages, but they're not useful content
- We save library catalog entries as "articles"

**What's Needed**:
```typescript
// After fetching content, detect if it's actually an article
function isActualArticle(content: string, url: string): boolean {
  // Check for article indicators:
  // - Has substantial text (>1000 chars)
  // - Has paragraphs, not just metadata fields
  // - Not a catalog/authority page structure
  // - Has actual narrative content
}
```

### 3. **DeepSeek Prompt Enhancement** (HIGH PRIORITY)

**Problem**: Current prompt only checks relevance, not content quality:
- Doesn't distinguish articles from metadata pages
- Doesn't check if content is substantial
- Doesn't verify it's actually readable content

**Current Prompt**:
```
Analyze this article for relevance to "{topic}":
Score 0-100 based on relevance...
```

**What's Needed**:
```typescript
const prompt = `Analyze this content for relevance to "${topic}":

Title: ${title}
URL: ${url}
Content: ${contentText}

IMPORTANT: First verify this is an actual article, not a metadata/catalog page.

Return JSON:
{
  "score": 0-100,
  "isRelevant": boolean,
  "isActualArticle": boolean,  // NEW: Is this real content?
  "contentQuality": "high" | "medium" | "low",  // NEW: Quality assessment
  "reason": string
}

Reject if:
- It's a library catalog entry
- It's an authority file
- It's just metadata (no narrative content)
- Content is too short or lacks substance
`
```

### 4. **Hero Images** (NEEDS VERIFICATION)

**Status**: Hero enrichment is being triggered, but we need to verify:
- Is `/api/internal/enrich/[id]` actually working?
- Are hero images being generated?
- Are they being saved to the Hero table?

**Current Implementation**:
- ✅ Hero enrichment API endpoint exists
- ✅ Wikipedia processor calls it after saving
- ❓ Need to verify it's actually generating images

**What to Check**:
```sql
SELECT 
  dc.id,
  dc.title,
  h.status,
  h.image_url,
  h.error_message
FROM discovered_content dc
LEFT JOIN heroes h ON h.content_id = dc.id
WHERE dc.category = 'wikipedia_citation'
ORDER BY dc.created_at DESC
LIMIT 20;
```

### 5. **Content Extraction Rate** (INVESTIGATE)

**Problem**: Only 79 out of 7,874 citations have content extracted (1%)

**Possible Causes**:
- Most citations are failing URL verification
- Many are Wikipedia internal links (should be filtered earlier)
- Processing is slow/incremental
- Errors are being silently caught

**What's Needed**:
- Better logging for why citations fail
- Filter Wikipedia internal links in Phase 1 (not Phase 2)
- Track content extraction success rate

## 🔧 Recommended Fixes (Priority Order)

### Priority 1: Add URL Quality Filtering

**Location**: `wikipediaProcessor.ts:451-458` (before URL verification)

```typescript
// Filter out low-quality URLs BEFORE processing
function isLowQualityUrl(url: string): boolean {
  const lowQualityDomains = [
    'viaf.org',
    'id.loc.gov',
    'id.ndl.go.jp',
    'nli.org.il',
    'collections.yale.edu',
    'web.archive.org',
    'commons.wikimedia.org',
  ]
  
  const lowQualityPatterns = [
    /\/authorities\//,
    /\/viaf\//,
    /\/auth\//,
    /\/catalog\//,
    /\/authority\//,
  ]
  
  const domain = new URL(url).hostname.replace(/^www\./, '')
  if (lowQualityDomains.some(d => domain.includes(d))) {
    return true
  }
  
  return lowQualityPatterns.some(pattern => pattern.test(url))
}

// In processNextCitation, before verification:
if (isLowQualityUrl(citationUrl)) {
  console.log(`[WikipediaProcessor] Skipping low-quality URL: ${citationUrl}`)
  await markCitationVerificationFailed(
    nextCitation.id,
    'Low-quality URL (library catalog, authority file, etc.)'
  )
  return { processed: true, citationUrl }
}
```

### Priority 2: Enhance DeepSeek Prompt

**Location**: `wikipediaProcessor.ts:38-53`

Add content quality checks to the prompt:
- Verify it's an actual article
- Check content quality
- Reject metadata/catalog pages

### Priority 3: Filter Wikipedia Internal Links Earlier

**Location**: `wikipediaProcessor.ts:250-257` (Phase 1)

Currently filtering in Phase 1, but also need to skip processing in Phase 2:
```typescript
// In processNextCitation, check if it's a Wikipedia link
if (citationUrl.includes('wikipedia.org/wiki/')) {
  // Skip Wikipedia internal links
  await markCitationVerificationFailed(
    nextCitation.id,
    'Wikipedia internal link - not an external citation'
  )
  return { processed: true, citationUrl }
}
```

### Priority 4: Add Content Type Detection

**Location**: `wikipediaProcessor.ts:530-540` (after content extraction)

```typescript
function isActualArticle(content: string, url: string): boolean {
  // Must have substantial content
  if (content.length < 1000) return false
  
  // Check for article structure (paragraphs, not just metadata)
  const paragraphCount = (content.match(/\n\n/g) || []).length
  if (paragraphCount < 3) return false
  
  // Check for narrative indicators
  const hasNarrative = /\. [A-Z]/.test(content) // Sentences
  if (!hasNarrative) return false
  
  // Reject if it looks like a catalog/authority page
  const catalogIndicators = [
    'authority control',
    'catalog record',
    'bibliographic',
    'metadata',
    'VIAF',
    'LCCN',
    'ISNI'
  ]
  
  const lowerContent = content.toLowerCase()
  const catalogScore = catalogIndicators.filter(ind => 
    lowerContent.includes(ind)
  ).length
  
  // If more than 2 catalog indicators, likely not an article
  return catalogScore < 2
}
```

### Priority 5: Verify Hero Images

**Action**: Run SQL query to check hero generation status
**Action**: Check logs for hero generation errors
**Action**: Test hero enrichment API manually

## 📋 New Page Readiness Checklist

### ✅ Ready
- [x] Wikipedia monitoring initialization
- [x] Citation extraction
- [x] DeepSeek scoring integration
- [x] DiscoveredContent saving
- [x] AgentMemory saving
- [x] Hero enrichment triggering

### ❌ NOT Ready
- [ ] URL quality filtering (library catalogs, authority files)
- [ ] Content type detection (article vs. metadata)
- [ ] Enhanced DeepSeek prompt (quality checks)
- [ ] Wikipedia internal link filtering in Phase 2
- [ ] Hero image generation verification
- [ ] Better error logging for failed citations

## 🎯 What Needs to Happen Before Production

1. **Add URL quality filtering** - Skip library catalogs, authority files
2. **Enhance DeepSeek prompt** - Check for actual articles, not metadata
3. **Add content type detection** - Verify it's real content
4. **Verify hero images** - Ensure they're actually being generated
5. **Improve logging** - Track why citations fail
6. **Filter Wikipedia links** - Skip internal Wikipedia links earlier

## 💡 Key Insight

**The real problem isn't the score threshold (60 vs. 50)** - it's that we're:
1. Processing low-quality URLs (library catalogs) that shouldn't be processed at all
2. Scoring metadata pages as if they were articles
3. Not detecting content type before scoring

**Solution**: Filter BEFORE processing, not after scoring.

---

**Next Steps**: 
1. Implement URL quality filtering
2. Enhance DeepSeek prompt
3. Add content type detection
4. Verify hero images are working
5. Test with a new patch

