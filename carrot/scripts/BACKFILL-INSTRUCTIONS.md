# Content Quality Backfill Instructions

## Current Status

- ✅ **Hero Images**: 96.1% have real images (49/51)
- ❌ **Content Quality**: 0% grammar cleaned (needs backfill)
- ❌ **Quotes**: 0% have quotes (needs extraction)

## How to Backfill Content Quality

### Option 1: Run Script on Server (Recommended)

The script `backfill-all-content-quality.ts` can be run directly on the server where `DEEPSEEK_API_KEY` is available:

```bash
# On production server
cd carrot
npx tsx scripts/backfill-all-content-quality.ts
```

**What it does:**
- Processes all 51 content items
- Cleans summaries with DeepSeek (removes UI text, fixes grammar)
- Completes key facts (removes fragments, ensures complete sentences)
- Skips recently cleaned items (within 24 hours)
- Saves cleaned content to database

**Expected time:** ~2-3 minutes per item (with 2s delay) = ~2 hours total

### Option 2: Use API Endpoint

Call the enrichment API endpoint:

```bash
curl -X POST https://carrot-app.onrender.com/api/dev/enrich-israel-content \
  -H "x-internal-key: ${INTERNAL_API_KEY}"
```

**What it does:**
- Same as script but via HTTP
- Processes 50 items at a time
- Returns detailed results

### Option 3: Automatic (Preview API)

Content will be automatically cleaned when users view it:
- Preview API checks if content needs cleanup
- Runs DeepSeek cleanup if needed
- Persists cleaned content to database

**Note:** This is slower but happens automatically as users browse.

## What Gets Cleaned

### Summaries
- Removes UI text: "Bookreader", "Item Preview", "Share or Embed"
- Removes metadata: "Openlibrary_edition", "Page_number_confidence"
- Fixes grammar and sentence structure
- Ensures complete, professional paragraphs (120-240 words)

### Key Facts
- Completes incomplete sentences
- Removes fragments like "It was just that..."
- Ensures each fact is standalone and meaningful
- Fixes grammar and punctuation

## Monitoring Progress

Check progress with:
```bash
npx tsx scripts/comprehensive-hero-audit.ts
```

Look for:
- `Items grammar cleaned: X (Y%)` - should increase
- `Items with good summary: X (Y%)` - should increase
- `Items with poor summary: X (Y%)` - should decrease

## After Backfill

Once backfill is complete:
- All summaries should be clean and professional
- All key facts should be complete sentences
- Content quality should be 100% cleaned
- Users will see improved content immediately

