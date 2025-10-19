# URL Cache Optimization for Discovery System

## Overview

The discovery system now uses an **in-memory URL cache** to prevent re-processing URLs that have already been approved or denied. This dramatically reduces DeepSeek API costs and speeds up discovery.

## How It Works

### 1. **URL Cache Building** (Before DeepSeek)

When discovery starts, we build a cache of ALL processed URLs for this patch:

```typescript
// Query database for ALL processed URLs (approved + denied)
const processedUrls = await prisma.discoveredContent.findMany({
  where: { patchId: patch.id },
  select: { 
    sourceUrl: true, 
    canonicalUrl: true,
    title: true,
    status: true 
  }
});

// Build fast lookup cache (Set for O(1) lookups)
const urlCache = new Set<string>();
processedUrls.forEach(item => {
  if (item.sourceUrl) urlCache.add(item.sourceUrl);
  if (item.canonicalUrl) urlCache.add(item.canonicalUrl);
});
```

**Cache Contents:**
- ✅ **Approved URLs** (status='ready') - Content is live on the page
- ❌ **Denied URLs** (status='denied') - Content was rejected (low relevance or no image)

### 2. **Pre-Flight Check** (Skip Duplicates Instantly)

For EVERY URL that DeepSeek returns:

```typescript
// 1. Canonicalize URL first (normalize tracking params, etc.)
const canonicalUrl = await canonicalize(item.url);

// 2. Check URL cache IMMEDIATELY
if (urlCache.has(item.url) || urlCache.has(canonicalUrl)) {
  console.log('⚡ Skipped (URL in cache)');
  continue; // Skip ALL processing - no DeepSeek, no image gen, nothing
}
```

**Benefits:**
- **Instant rejection** of duplicate URLs (no DB query needed)
- **No wasted API calls** to DeepSeek for known URLs
- **No wasted image generation** for rejected URLs

### 3. **Save Denied URLs to Database**

When a URL fails validation, we save it to the database with `status='denied'`:

```typescript
// Low relevance score (<0.7)
if (relevanceScore < 0.7) {
  await prisma.discoveredContent.create({
    data: {
      patchId: patch.id,
      sourceUrl: item.url,
      canonicalUrl: canonicalUrl,
      status: 'denied', // 🚫 Mark as denied
      // ... other fields
    }
  })
  
  // Add to cache immediately so we skip it next time
  urlCache.add(item.url);
  urlCache.add(canonicalUrl);
  continue;
}

// Image generation failed
if (!aiImageUrl) {
  // Same logic - save as 'denied' and add to cache
}
```

**Why This Matters:**
- **Rejected URLs are never re-processed** - If DeepSeek returns the same URL in a future search, we skip it instantly
- **No infinite retry loops** - Once a URL is denied, it stays denied
- **Historical record** - You can see which URLs were rejected and why

### 4. **Save Approved URLs to Database**

When a URL passes all checks:

```typescript
const discoveredContent = await prisma.discoveredContent.create({
  data: {
    patchId: patch.id,
    sourceUrl: item.url,
    canonicalUrl: canonicalUrl,
    status: 'ready', // ✅ Mark as approved
    mediaAssets: {
      heroImage: {
        url: aiImageUrl,
        source: 'ai-generated',
        license: 'generated'
      }
    },
    // ... other fields
  }
})

// Add to cache immediately
urlCache.add(item.url);
urlCache.add(canonicalUrl);
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Discovery Starts                                          │
│    ↓                                                          │
│    Build URL Cache from DB (approved + denied)               │
│    Cache Size: 51 URLs (example)                             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Agent Finds URL                                           │
│    URL: https://example.com/article                          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
                    ┌────────┐
                    │ Cache? │
                    └───┬────┘
                        │
          YES ─────────┴───────── NO
           │                      │
           ↓                      ↓
    ⚡ Skip Instantly      3. Call DeepSeek
    (No API calls)               ↓
                         Check Relevance
                                 │
                   Low ──────────┼────────── High
                    │                         │
                    ↓                         ↓
            4. Save as 'denied'      5. Generate Image
            Add to cache                     │
                                  Fail ──────┼────── Success
                                   │                  │
                                   ↓                  ↓
                           Save as 'denied'   6. Save as 'ready'
                           Add to cache       Add to cache
                                              Show on page! ✨
```

## Database Schema

The `discoveredContent` table now uses the `status` field more effectively:

```prisma
model DiscoveredContent {
  id              String   @id @default(cuid())
  patchId         String
  sourceUrl       String?
  canonicalUrl    String?  // Used for deduplication
  status          String   // 'ready', 'denied', 'queued', 'fetching', etc.
  
  // ... other fields
}
```

**Status Values:**
- `'ready'` = Approved (content is live on the page)
- `'denied'` = Rejected (low relevance or failed image generation)
- `'queued'`, `'fetching'`, `'enriching'` = Processing states (not used in current flow)

## Performance Metrics

**Before Optimization:**
- ❌ Call DeepSeek for every URL → Parse → Check DB → Maybe reject
- ❌ Cost: $0.001 per DeepSeek call × 100 duplicates = $0.10 wasted
- ❌ Time: ~2-3 seconds per duplicate check

**After Optimization:**
- ✅ Build cache once (50ms for 1000 URLs)
- ✅ Check cache (0.1ms per URL)
- ✅ Cost: $0 for duplicates
- ✅ Time: ~0.1ms per duplicate

**Example Session:**
```
🗄️ URL Cache built: {
  totalProcessed: 51,
  approved: 51,
  denied: 0,
  cacheSize: 51
}

⚡ Skipped (URL in cache): https://www.nba.com/bulls
⚡ Skipped (URL in cache): https://www.espn.com/nba/team/_/name/chi/chicago-bulls
⚡ Skipped (URL in cache): https://www.basketball-reference.com/teams/CHI/
... (17 total skips)

✅ Item saved with image: clxy8z3t5000008l6g9x7e4y2
```

## Console Logs to Watch For

- `🗄️ URL Cache built:` - Shows how many URLs are in the cache
- `⚡ Skipped (URL in cache):` - URL was found in cache and skipped instantly
- `❌ Rejected (low relevance):` - URL failed relevance check and was saved as 'denied'
- `❌ Rejected (no image):` - Image generation failed and URL was saved as 'denied'
- `✅ Item saved with image:` - URL passed all checks and was saved as 'ready'

## Future Enhancements

1. **Persistent Cache** - Move cache to Redis for cross-session persistence
2. **Cache Expiry** - Allow denied URLs to be retried after 30 days
3. **URL Patterns** - Block entire domains or URL patterns (e.g., all Wikipedia URLs)
4. **Quality Scoring** - Track success rates per domain/source
5. **Manual Override** - Admin interface to manually approve/deny URLs

## Related Documentation

- [DISCOVERY-HOW-IT-WORKS.md](./DISCOVERY-HOW-IT-WORKS.md) - How duplicate prevention works overall
- [canonicalization.ts](../src/lib/discovery/canonicalization.ts) - URL normalization logic
- [logger.ts](../src/lib/discovery/logger.ts) - Batched logging for duplicate tracking

