# Content Enrichment Scripts

## Status

✅ **Hero Images**: 96.1% have real images (49/51 Wikimedia images)
❌ **Content Quality**: Needs server-side enrichment with DeepSeek API

## Scripts Created

1. **`backfill-hero-images-real.ts`** - ✅ COMPLETED
   - Replaced 31 SVG placeholders with real Wikimedia images
   - Result: 96.1% coverage (49/51 real images)

2. **`enrich-content-direct.ts`** - ⚠️ NEEDS SERVER
   - Enriches content with quotes and grammar cleanup
   - Requires DeepSeek API key (only available on server)
   - Must be run on production server or with API key in environment

## How to Run Enrichment on Server

The enrichment script needs to run where `DEEPSEEK_API_KEY` is available:

```bash
# On production server
cd carrot
npx tsx scripts/enrich-content-direct.ts
```

Or trigger via API endpoint (if created):
```bash
curl -X POST https://carrot-app.onrender.com/api/dev/enrich-israel-content
```

## Current State

- **Hero Images**: ✅ Fixed (96.1% real images)
- **Quotes**: ❌ 0% (needs enrichment)
- **Grammar Cleanup**: ❌ 0% (needs enrichment)
- **Poor Summaries**: 2 items still need fixing

## Next Steps

1. Run `enrich-content-direct.ts` on server to add quotes and grammar cleanup
2. The preview API (`/api/internal/content/[id]/preview`) should also trigger cleanup when content is viewed
3. Monitor content quality after enrichment

