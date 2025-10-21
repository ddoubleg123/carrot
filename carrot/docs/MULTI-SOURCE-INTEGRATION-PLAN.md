# Multi-Source Discovery Integration Plan

## ✅ **Phase 1: Complete** (Just Committed)

Created the following new modules:

1. **`searchCoordinator.ts`** - DeepSeek generates search strategy
2. **`wikipediaSource.ts`** - Wikipedia API + citation extractor  
3. **`newsSource.ts`** - NewsAPI integration
4. **`multiSourceOrchestrator.ts`** - Coordinates all sources

## 🔄 **Phase 2: Integration** (Next Step)

### Current State
- `start-discovery/route.ts` (855 lines) uses old DeepSeek URL guessing
- Calls DeepSeek → gets URLs → validates → saves to DB
- Streaming SSE implementation for real-time updates

### Required Changes

#### **Option A: Replace Existing Logic (Recommended)**

Replace lines 100-250 in `start-discovery/route.ts`:

**OLD:**
```typescript
// Call DeepSeek to guess URLs
const deepSeekResponse = await fetch('https://api.deepseek.com/...')
const discoveredItems = parseURLs(deepSeekResponse)
```

**NEW:**
```typescript
// Use multi-source orchestrator
const orchestrator = new MultiSourceOrchestrator()
const discoveryResult = await orchestrator.discover(
  patch.name,
  patch.description,
  patch.tags
)

// discoveryResult.sources contains:
// - Wikipedia pages (5-10)
// - Wikipedia citations (50-200+)
// - News articles (10-20)
// Total: 100-300+ sources
```

#### **Option B: Keep Both Systems**

Add a feature flag to choose between:
- **Legacy:** DeepSeek URL guessing (current)
- **MultiSource:** New comprehensive system

```typescript
const useMultiSource = process.env.ENABLE_MULTI_SOURCE === 'true'

if (useMultiSource) {
  // New system
} else {
  // Old system
}
```

### Integration Steps

1. **Update `start-discovery/route.ts`**:
   ```typescript
   // After authentication checks...
   const orchestrator = new MultiSourceOrchestrator()
   const result = await orchestrator.discover(
     patch.name,
     patch.description,
     patch.tags
   )
   
   // For SSE streaming:
   for (const source of result.sources) {
     sendEvent('item-found', {
       title: source.title,
       url: source.url,
       type: source.type,
       source: source.source,
       description: source.description
     })
     
     // Save to database...
   }
   ```

2. **Update Database Schema**:
   Add fields to `DiscoveredContent`:
   ```prisma
   model DiscoveredContent {
     // ... existing fields ...
     
     sourceType         String?  // 'wikipedia' | 'citation' | 'news' | 'article'
     sourceProvider     String?  // 'Wikipedia', 'NewsAPI', etc.
     parentWikipediaPage String? // For citations
     citationIndex      Int?     // For citations
     
     @@index([sourceType])
     @@index([sourceProvider])
   }
   ```

3. **Streaming Implementation**:
   The orchestrator doesn't currently stream. Options:
   - **A:** Keep synchronous (simpler)
   - **B:** Make orchestrator yield sources as they're found
   
   For B:
   ```typescript
   async *discoverStreaming() {
     yield { type: 'strategy', data: strategy }
     
     for await (const page of wikipediaPages) {
       yield { type: 'wikipedia', data: page }
       
       for (const citation of page.citations) {
         yield { type: 'citation', data: citation }
       }
     }
     
     for await (const article of newsArticles) {
       yield { type: 'news', data: article }
     }
   }
   ```

## 📊 **Expected Results**

### Before (Current System)
**User clicks "Discovering content":**
- DeepSeek generates 1-10 URLs
- ~50% are broken/generic
- ~5 valid sources per run
- Limited depth

### After (Multi-Source System)
**User clicks "Discovering content":**
- DeepSeek generates strategy
- Wikipedia: 5-10 pages found
- Wikipedia Citations: 50-200+ sources
- NewsAPI: 10-20 recent articles
- **Total: 100-300+ high-quality sources**
- All Wikipedia citations are real, cited sources
- Comprehensive topic coverage

## 🎯 **Testing Plan**

1. **Test Chicago Bulls discovery:**
   ```
   Expected Wikipedia pages:
   - Chicago Bulls
   - Michael Jordan
   - Phil Jackson
   - 1995-96 Chicago Bulls season
   - Triangle offense
   
   Expected citations: 50-100 from these pages
   Expected news: 10-15 recent Bulls articles
   ```

2. **Verify citation quality:**
   - All citations have URLs
   - URLs are from authoritative domains
   - No duplicates across pages
   - Parent page relationship tracked

3. **Performance:**
   - Wikipedia rate limiting works (1s/page)
   - NewsAPI respects limits
   - Total time: 30-60 seconds for full discovery
   - Streaming shows progress

## ⚠️ **Considerations**

1. **Rate Limits:**
   - Wikipedia: 60 req/min (we use 1s delay = safe)
   - NewsAPI: 1000 req/day on free tier
   - DeepSeek: Normal API limits

2. **Cost:**
   - Wikipedia: FREE
   - NewsAPI: FREE tier (100 req/day) or paid
   - DeepSeek: Token usage (strategy generation only)

3. **Storage:**
   - 100-300 sources per discovery
   - Need good deduplication
   - Database will grow faster

4. **UX:**
   - Longer discovery time (30-60s vs 5-10s)
   - Better progress indication needed
   - "Found 157 sources" vs "Found 5 sources"

## 🚀 **Rollout Strategy**

### Phase 1: Feature Flag (This Week)
```env
ENABLE_MULTI_SOURCE=false  # Default: use old system
```

### Phase 2: Parallel Testing (Next Week)
- Enable for test patches only
- Compare results quality
- Monitor performance

### Phase 3: Gradual Rollout
- Enable for new patches
- Migrate existing patches on-demand
- Full switch after validation

### Phase 4: Deprecate Old System
- Remove DeepSeek URL guessing
- Multi-source becomes default
- Update documentation

## 📝 **Next Actions**

1. ✅ Create multi-source modules (DONE)
2. ⏳ Update `start-discovery/route.ts` integration
3. ⏳ Add database migration for new fields
4. ⏳ Test with Chicago Bulls patch
5. ⏳ Add feature flag control
6. ⏳ Update UI to handle larger result sets
7. ⏳ Deploy to staging
8. ⏳ Production rollout

---

**Ready to proceed with Phase 2 integration?**
