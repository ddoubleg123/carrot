# Anna's Archive Integration Plan

## Overview

Anna's Archive (https://annas-archive.org/) is a search engine for books, papers, comics, magazines, and more. It aggregates data from multiple sources including Library Genesis, Sci-Hub, Z-Library, and Internet Archive.

## Integration Options

### Option 1: Web Scraping (Recommended for MVP)
- **Pros**: No membership required, works immediately
- **Cons**: May break if site structure changes, rate limiting
- **Implementation**: Use unofficial JavaScript library or build custom scraper

### Option 2: Official API (Requires Membership)
- **Pros**: Official, stable, fast download URLs
- **Cons**: Requires membership, limited to `/dyn/api/fast_download.json`
- **Implementation**: Direct API calls with membership credentials

### Option 3: Database Access (Full Access)
- **Pros**: Complete access, custom searches, iterate all files
- **Cons**: Requires downloading ElasticSearch/MariaDB databases (large)
- **Implementation**: Set up local database instance

## Recommended Approach: Hybrid

1. **Start with web scraping** (Option 1) for search/discovery
2. **Add API support** (Option 2) if membership obtained
3. **Consider database** (Option 3) for high-volume use cases

## Implementation Plan

### Phase 1: Search Integration
- Create `annasArchiveSource.ts` module
- Implement search function (web scraping or API)
- Integrate into `MultiSourceOrchestrator`
- Add to discovery flow

### Phase 2: Content Extraction
- Extract book/paper metadata
- Get download links (if available)
- Extract preview text/excerpts
- Create DiscoveredContent entries

### Phase 3: Enrichment
- Use existing enrichment pipeline
- Generate hero images for book covers
- Extract key quotes and facts
- Clean content with DeepSeek

## Search Strategy

Anna's Archive search supports:
- Title search
- Author search
- ISBN search
- Language filtering
- File type filtering (PDF, EPUB, etc.)

For discovery, we'll:
1. Search by topic keywords
2. Filter by relevance to patch
3. Extract metadata and previews
4. Save as DiscoveredContent

## Example Search Flow

```typescript
// Search Anna's Archive for "Israel history"
const results = await searchAnnasArchive({
  query: "Israel history",
  language: "en",
  fileType: "pdf",
  limit: 20
})

// For each result:
// 1. Extract metadata (title, author, year, ISBN)
// 2. Get preview/excerpt if available
// 3. Score relevance using DeepSeek
// 4. Save to DiscoveredContent if relevant
```

## Next Steps

1. Create `annasArchiveSource.ts` module
2. Implement search function
3. Add to `MultiSourceOrchestrator`
4. Test with Israel patch
5. Monitor and refine

