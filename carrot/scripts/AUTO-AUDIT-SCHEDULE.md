# Automatic Self-Auditing Schedule

## When It Runs Automatically

### 1. **During Discovery (Real-time)**
**Trigger:** Every time content is saved during a discovery run

**Location:** `carrot/src/lib/discovery/orchestrator.ts` (lines 1569-1592)

**What happens:**
```typescript
// After saving content
if (hero is missing or placeholder) {
  → Automatically calls enrichContentId(savedItem.id)
  → Enrichment worker generates hero image
  → Database updated with new hero
}
```

**Frequency:** Every discovery run (whenever you start discovery)

### 2. **During Citation Processing**
**Trigger:** When processing Wikipedia citations

**Location:** `carrot/scripts/process-all-citations-enhanced.ts` (lines 208-220)

**What happens:**
- Citation content saved
- Hero image generation automatically triggered
- Same pipeline as discovery

**Frequency:** When running citation processing scripts

### 3. **During Content Enrichment**
**Trigger:** When `enrichContentId()` is called (via API or worker)

**Location:** `carrot/src/lib/enrichment/worker.ts`

**What happens:**
- Fetches content from source URL
- Extracts text, quotes, summary
- Searches for hero images (OpenGraph → inline → Wikimedia → AI → placeholder)
- Creates/updates Hero record
- Grammar/quality issues logged

**Frequency:** 
- Automatically during discovery
- When manually calling enrichment API
- When content is viewed (if preview triggers enrichment)

## Manual Triggers

### Run Self-Audit Scripts

```bash
# Hero images only
npx tsx scripts/self-audit-hero-images.ts israel

# Grammar/quality only  
npx tsx scripts/self-audit-grammar-quality.ts israel

# Both audits
npx tsx scripts/self-audit-all.ts israel
```

**When to run manually:**
- After importing bulk content
- To fix existing content with issues
- Weekly maintenance
- After system updates

## What Gets Checked

### Hero Images (Automatic)
- ✅ Missing hero images → Auto-triggers generation
- ✅ Placeholder images → Auto-triggers generation  
- ✅ Skeleton/SVG images → Auto-triggers generation

### Grammar/Quality (Automatic)
- ✅ Quality score < 60 → Logged (rejected during discovery)
- ✅ Grammar issues → Logged during enrichment
- ⚠️ Low quality content → Can be re-processed manually

## Timeline Example

```
User starts discovery run
  ↓
Content found: "Israel Rising: The Land of Israel Reawakens"
  ↓
Content extracted from Anna's Archive
  ↓
DeepSeek enrichment (grammar checked here)
  ↓
Hero image generated via heroPipeline.assignHero()
  ↓
Content saved to database
  ↓
[IF hero missing/placeholder detected]
  → enrichContentId() triggered automatically
  → Enrichment worker searches for hero
  → Hero image found/generated
  → Database updated
  ↓
Content appears on patch page with hero image ✅
```

## Monitoring

Check logs for these messages:

**Hero Images:**
- `[Orchestrator] 🎨 Hero image missing/placeholder` - Auto-triggered
- `[Orchestrator] ✅ Self-audit generated hero image` - Success
- `[Enrichment Worker] ✅ Hero image found` - Success

**Grammar/Quality:**
- `[Enrich Content] ⚠️  Quality/grammar issues detected` - Issue found
- `[Enrich Content] ✅ DeepSeek processed content` - Success

## Best Practices

1. **Let automatic system work** - It runs during every discovery
2. **Run manual audits weekly** - Fix any items that slipped through
3. **Monitor logs** - Check for patterns in failures
4. **Use dry-run first** - Test before making changes: `--dry-run`

## API Connection Fix

The scripts now automatically detect if running locally or on server:

- **Local:** Tries `http://localhost:3000` first, falls back to production
- **Server:** Uses `NEXTAUTH_URL` environment variable or production URL

This means the scripts will work both:
- ✅ Locally (if dev server is running)
- ✅ On production server (where APIs are accessible)

