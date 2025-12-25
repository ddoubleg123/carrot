# When Automatic Self-Auditing Runs

## Automatic Triggers

### 1. **During Discovery (Real-time)**

**When:** Every time new content is saved during a discovery run

**What happens:**
- Content is extracted and enriched
- Hero image is generated via `heroPipeline.assignHero()`
- If hero image is missing or placeholder → **Automatically triggers `enrichContentId()`**
- Grammar/quality is checked during DeepSeek enrichment
- Issues are logged for monitoring

**Location:** `carrot/src/lib/discovery/orchestrator.ts` (lines 1569-1592)

```typescript
// Trigger hero image self-audit if missing or placeholder (non-blocking)
if (isPlaceholder) {
  console.log(`[Orchestrator] 🎨 Hero image missing/placeholder, triggering self-audit`)
  enrichContentId(savedItem.id) // ← Automatic!
}
```

### 2. **During Citation Processing**

**When:** When processing Wikipedia citations

**What happens:**
- Citation content is saved
- Hero image generation is triggered automatically
- Same pipeline as discovery

**Location:** `carrot/scripts/process-all-citations-enhanced.ts` (lines 208-220)

### 3. **During Content Enrichment**

**When:** When `enrichContentId()` is called (via API or worker)

**What happens:**
- Fetches content from source URL
- Extracts text, quotes, summary
- Searches for hero images (OpenGraph → inline → Wikimedia → AI → placeholder)
- Creates/updates Hero record
- Grammar/quality issues are logged

**Location:** `carrot/src/lib/enrichment/worker.ts`

## Manual Triggers

### 1. **Self-Audit Scripts**

Run manually to fix existing content:

```bash
# Hero images only
npx tsx scripts/self-audit-hero-images.ts israel

# Grammar/quality only
npx tsx scripts/self-audit-grammar-quality.ts israel

# Both
npx tsx scripts/self-audit-all.ts israel
```

### 2. **API Endpoints** (if created)

You can create API endpoints to trigger audits:

```typescript
// POST /api/patches/[handle]/audit/hero-images
// POST /api/patches/[handle]/audit/grammar-quality
```

## What Gets Checked Automatically

### Hero Images
- ✅ Missing hero images → Triggers generation
- ✅ Placeholder images → Triggers generation
- ✅ Skeleton/SVG images → Triggers generation

### Grammar/Quality
- ✅ Quality score < 60 → Logged (rejected during discovery)
- ✅ Grammar issues → Logged during enrichment
- ⚠️ Low quality content → Can be re-processed manually

## Timeline

```
Discovery Run Starts
  ↓
Content Found & Extracted
  ↓
DeepSeek Enrichment (grammar checked here)
  ↓
Hero Image Generated
  ↓
Content Saved to Database
  ↓
[IF hero missing/placeholder]
  → enrichContentId() triggered automatically
  → Hero image generated via enrichment worker
  → Database updated
```

## Monitoring

Check logs for:
- `[Orchestrator] 🎨 Hero image missing/placeholder` - Auto-triggered
- `[Orchestrator] ✅ Self-audit generated hero image` - Success
- `[Enrich Content] ⚠️  Quality/grammar issues detected` - Issue found

## Best Practices

1. **Let automatic system work** - It runs during every discovery
2. **Run manual audits weekly** - Fix any items that slipped through
3. **Monitor logs** - Check for patterns in failures
4. **Use dry-run first** - Test before making changes

