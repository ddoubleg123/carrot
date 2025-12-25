# Self-Auditing System

Automated quality assurance for hero images and content grammar/quality.

## Overview

The self-auditing system automatically detects and fixes:
1. **Missing or placeholder hero images** - Generates real hero images via AI or Wikimedia
2. **Poor grammar and low-quality content** - Re-processes content through DeepSeek API

## Scripts

### 1. `self-audit-hero-images.ts`

Audits and fixes missing or placeholder hero images.

**Usage:**
```bash
# Audit all items for a patch
npx tsx scripts/self-audit-hero-images.ts israel

# Limit to 50 items
npx tsx scripts/self-audit-hero-images.ts israel --limit=50

# Dry run (no changes)
npx tsx scripts/self-audit-hero-images.ts israel --dry-run
```

**What it does:**
- Scans all discovered content for missing or placeholder hero images
- Generates hero images using the same pipeline as discovery (AI → Wikimedia → Skeleton)
- Updates database with new hero images

### 2. `self-audit-grammar-quality.ts`

Audits and fixes grammar issues and low-quality content.

**Usage:**
```bash
# Audit all items
npx tsx scripts/self-audit-grammar-quality.ts israel

# Limit to 50 items with minimum quality score of 70
npx tsx scripts/self-audit-grammar-quality.ts israel --limit=50 --min-quality=70

# Dry run
npx tsx scripts/self-audit-grammar-quality.ts israel --dry-run
```

**What it does:**
- Detects grammar issues (their/there/they're, capitalization, run-on sentences, etc.)
- Identifies low-quality content (quality score < 60, poor summaries, missing key facts)
- Re-processes content through DeepSeek API with enhanced grammar verification
- Updates database with improved content

### 3. `self-audit-all.ts`

Runs both audits in sequence and provides a comprehensive report.

**Usage:**
```bash
# Run both audits
npx tsx scripts/self-audit-all.ts israel

# With options
npx tsx scripts/self-audit-all.ts israel --limit=100 --dry-run
```

## Automatic Integration

The self-auditing system is automatically integrated into the discovery process:

1. **Hero Images**: When content is saved during discovery, if the hero image is missing or a placeholder, the system automatically triggers hero generation via the enrichment worker.

2. **Grammar Quality**: During content enrichment, the system logs grammar/quality issues for monitoring. Content that fails quality checks is rejected before being saved.

## How It Works

### Hero Image Pipeline

1. **AI Generation** (Primary) - Tries to generate an AI image based on title/summary
2. **Wikimedia Search** (Fallback) - Searches Wikimedia Commons for relevant images
3. **Skeleton Placeholder** (Last Resort) - Creates a gradient placeholder

### Grammar Quality Pipeline

1. **Pattern Detection** - Detects common grammar issues using regex patterns
2. **Quality Scoring** - Checks quality score, summary length, key facts count
3. **DeepSeek Re-processing** - Re-processes content through DeepSeek API with enhanced grammar verification
4. **Database Update** - Updates content with improved summary, facts, and quotes

## Anna's Archive Support

Anna's Archive content goes through the **same hero image pipeline** as Wikipedia sources:

1. Content is extracted from Anna's Archive
2. Content is enriched with DeepSeek
3. Hero image is generated via `heroPipeline.assignHero()` (same as Wikipedia)
4. Hero image is saved to database

The self-auditing system ensures that any Anna's Archive content with missing hero images gets them automatically.

## Monitoring

The system logs all issues and fixes:
- Missing hero images are logged with `[Orchestrator] 🎨 Hero image missing/placeholder`
- Grammar issues are logged with `[Enrich Content] ⚠️  Quality/grammar issues detected`
- All fixes are tracked in the audit results

## Best Practices

1. **Run audits regularly** - Schedule weekly audits for active patches
2. **Use dry-run first** - Always test with `--dry-run` before making changes
3. **Monitor logs** - Check discovery logs for automatic self-audit triggers
4. **Set quality thresholds** - Adjust `--min-quality` based on your standards

## Troubleshooting

**Hero images not generating:**
- Check that `NEXTAUTH_URL` is set correctly
- Verify AI image generation API is accessible
- Check Wikimedia search API endpoint

**Grammar fixes not working:**
- Verify `DEEPSEEK_API_KEY` is set
- Check that DeepSeek API is accessible
- Review quality score thresholds

**Self-audit not running automatically:**
- Check that enrichment worker is enabled
- Verify discovery orchestrator is calling hero pipeline
- Review logs for import errors

