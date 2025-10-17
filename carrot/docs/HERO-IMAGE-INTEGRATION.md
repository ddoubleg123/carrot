# Hero Image Integration - Complete Guide

**Status:** ✅ Production Ready  
**Date:** October 16, 2025  
**Version:** 1.0.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Configuration](#configuration)
6. [Backfill Process](#backfill-process)
7. [Automated Discovery](#automated-discovery)
8. [Database Schema](#database-schema)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This system automatically generates **high-quality AI hero images** for all content in Carrot Patch groups, with intelligent fallback mechanisms and Firebase storage integration.

### Key Features

✅ **AI Image Generation** - SDXL pipeline with HD quality  
✅ **Automatic Integration** - New discoveries get images automatically  
✅ **Manual Backfill** - Process existing content page-by-page  
✅ **Smart Fallbacks** - Wikimedia → Open Graph → Placeholder  
✅ **Firebase Storage** - Secure, scalable image hosting  
✅ **Configurable** - Control limits, quality, and behavior  
✅ **Rate Limited** - Respects VAST AI server capacity  

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│           DISCOVERY PIPELINE                     │
│  User creates new patch → Discovers content     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│          CONTENT ENRICHMENT                      │
│  DeepSeek Audit → Summary → Tags → Status       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│         HERO IMAGE GENERATION                    │
│  1. AI Generation (SDXL + HD)                    │
│  2. Fallback: Wikimedia Commons                  │
│  3. Fallback: Open Graph Image                   │
│  4. Fallback: SVG Placeholder                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│          FIREBASE STORAGE                        │
│  Upload → Get URL → Save to Database             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│          GROUP LEVEL PAGE                        │
│  Display content cards with hero images          │
└─────────────────────────────────────────────────┘
```

---

## Installation

### 1. Install Dependencies

```bash
cd carrot
npm install tsx@^4.19.2
```

### 2. Set Environment Variables

Make sure your `.env.local` has:

```bash
# VAST AI for image generation
VAST_AI_URL=http://localhost:30401

# Firebase (already configured)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-bucket

# DeepSeek (already configured)
DEEPSEEK_API_KEY=sk-...
```

### 3. Verify Configuration

Check `src/config/discovery.ts` for default settings:

```typescript
export const DISCOVERY_CONFIG = {
  MAX_ITEMS_PER_RUN: 15,          // Limit per discovery run
  ENABLE_AUTO_IMAGES: true,        // Auto-generate on discovery
  DEFAULT_IMAGE_STYLE: 'hyperrealistic',
  HD_MODE: true,                   // HD quality by default
  RATE_LIMIT_MS: 10000,           // 10s between generations
  // ...
};
```

---

## Usage

### Quick Start

**Backfill a single patch:**

```bash
npm run backfill-images chicago-bulls
```

**Automated discovery** (images generate automatically when you discover new content)

---

## Configuration

### Discovery Settings

Edit `src/config/discovery.ts` to customize behavior:

```typescript
export const DISCOVERY_CONFIG = {
  // Maximum items to discover per run (per patch)
  MAX_ITEMS_PER_RUN: 15,  // ← Adjust this
  
  // Enable automatic AI image generation during discovery
  ENABLE_AUTO_IMAGES: true,  // ← Set false to disable auto-gen
  
  // Default artistic style
  DEFAULT_IMAGE_STYLE: 'hyperrealistic',  // ← Change style
  
  // Enable HD by default
  HD_MODE: true,  // ← Set false for faster generation
  
  // Rate limiting: milliseconds between generations
  RATE_LIMIT_MS: 10000,  // ← Adjust based on server capacity
  
  // Image quality thresholds
  MIN_IMAGE_WIDTH: 800,
  MIN_IMAGE_HEIGHT: 450,
  
  // Fallback sources (tried in order)
  FALLBACK_SOURCES: [
    'wikimedia',    // ← Try Wikimedia Commons first
    'og-image',     // ← Then Open Graph image
    'placeholder'   // ← Finally SVG placeholder
  ]
};
```

### Storage Paths

Images are organized in Firebase Storage:

```
firebase-storage/
├── discovered/          # Auto-generated images
│   └── {itemId}/
│       └── hero.png
├── patches/             # Patch-specific images
│   └── {patchHandle}/
│       └── hero-{itemId}.png
└── backfill/            # Backfilled images
    └── {patchHandle}/
        └── {itemId}.png
```

---

## Backfill Process

### Command Syntax

```bash
npm run backfill-images <patch-handle> [options]
```

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--limit N` | Process only N items | `--limit 20` |
| `--dry-run` | Preview without executing | `--dry-run` |
| `--no-skip` | Process items with existing images | `--no-skip` |
| `--help` | Show help message | `--help` |

### Examples

**Backfill Chicago Bulls patch:**

```bash
npm run backfill-images chicago-bulls
```

**Dry run to preview:**

```bash
npm run backfill-images chicago-bulls --dry-run
```

**Limit to 10 items:**

```bash
npm run backfill-images chicago-bulls --limit 10
```

**Re-process all items (including those with images):**

```bash
npm run backfill-images chicago-bulls --no-skip
```

### Sample Output

```
🎨 Carrot Hero Image Backfill
========================================
Patch: chicago-bulls
Limit: unlimited
Dry Run: false
Skip Existing: true
========================================

✅ Found patch: Chicago Bulls (chicago-bulls)

📊 Found 15 items needing images

[1/15] Processing: Derrick Rose MVP Season Analysis
  Type: article
  🎨 Generating AI image...
  ☁️  Uploading to Firebase...
  ✅ Success! Image generated and uploaded
  ⏳ Waiting 10s...

[2/15] Processing: Bulls Trade Rumors Heating Up
  Type: article
  🎨 Generating AI image...
  ☁️  Uploading to Firebase...
  ✅ Success! Image generated and uploaded
  ⏳ Waiting 10s...

...

========================================
🎉 Backfill Complete for Chicago Bulls
========================================
Total Items: 15
✅ Success (AI): 13
⚠️  Fallback: 2
❌ Failed: 0
⏭️  Skipped: 0
========================================
```

---

## Automated Discovery

### How It Works

When new content is discovered:

1. **Content Enrichment** - DeepSeek processes title/summary
2. **Auto Image Generation** - System automatically generates hero image
3. **Firebase Upload** - Image uploaded to storage
4. **Database Update** - `mediaAssets` field updated with image URL
5. **Display** - Image appears on patch page immediately

### Enabling/Disabling

**Disable automatic images:**

```typescript
// src/config/discovery.ts
export const DISCOVERY_CONFIG = {
  ENABLE_AUTO_IMAGES: false,  // ← Set to false
  // ...
};
```

**Enable again:**

```typescript
export const DISCOVERY_CONFIG = {
  ENABLE_AUTO_IMAGES: true,  // ← Set to true
  // ...
};
```

### Discovery Limits

By default, discovery is limited to **15 items per run**.

**Change the limit:**

```typescript
// src/config/discovery.ts
export const DISCOVERY_CONFIG = {
  MAX_ITEMS_PER_RUN: 20,  // ← Change to your desired limit
  // ...
};
```

---

## Database Schema

### DiscoveredContent Model

Images are stored in the `mediaAssets` JSON field:

```json
{
  "heroImageUrl": "https://firebasestorage.googleapis.com/...",
  "heroImageSource": "ai-generated-auto",
  "heroImageGeneratedAt": "2025-10-16T15:30:00Z",
  "heroImagePrompt": "Derrick Rose in Chicago Bulls jersey..."
}
```

### Image Sources

| Source | Description |
|--------|-------------|
| `ai-generated-auto` | Automatically generated during discovery |
| `ai-generated-backfill` | Generated via backfill script |
| `fallback-wikimedia` | Retrieved from Wikimedia Commons |
| `fallback-og-image` | Extracted from Open Graph tags |
| `fallback-placeholder` | SVG placeholder |

---

## Troubleshooting

### Issue: "Patch not found"

**Error:**
```
❌ Patch "chicago-bulls" not found
```

**Solution:**
Check the patch handle is correct:

```bash
# List all patches
psql $DATABASE_URL -c "SELECT handle, name FROM \"Patch\";"
```

---

### Issue: "No items found"

**Error:**
```
📊 Found 0 items needing images
🎉 All items already have hero images!
```

**Solutions:**

1. **Items already have images** (normal behavior)
2. **No approved content** - Check item status:

```sql
SELECT id, title, status FROM "DiscoveredContent" 
WHERE "patchId" = '<patch-id>';
```

3. **Use `--no-skip` to reprocess:**

```bash
npm run backfill-images chicago-bulls --no-skip
```

---

### Issue: Image generation fails

**Error:**
```
❌ Error: VAST AI API error: Connection refused
```

**Solutions:**

1. **Check VAST AI is running:**

```bash
curl http://localhost:30401/health
```

2. **Check environment variable:**

```bash
echo $VAST_AI_URL
```

3. **Restart VAST AI server**

4. **Try with fallbacks only:**

Edit `src/config/discovery.ts`:

```typescript
FALLBACK_SOURCES: [
  'wikimedia',
  'og-image',
  'placeholder'  // Will always succeed
]
```

---

### Issue: Rate limiting / Slow generation

**Problem:** Backfill takes too long

**Solutions:**

1. **Reduce rate limit:**

```typescript
// src/config/discovery.ts
RATE_LIMIT_MS: 5000  // 5 seconds instead of 10
```

2. **Disable HD for faster generation:**

```typescript
HD_MODE: false
```

3. **Use two servers efficiently** (you have 2 VAST AI servers):

Run backfills on separate terminals targeting different patches:

```bash
# Terminal 1
npm run backfill-images chicago-bulls

# Terminal 2
npm run backfill-images israeli-news
```

---

### Issue: Firebase upload fails

**Error:**
```
❌ Upload failed: Firebase Storage error
```

**Solutions:**

1. **Check Firebase credentials:**

```bash
# Verify .env.local
cat .env.local | grep FIREBASE
```

2. **Check storage bucket exists**

3. **Check permissions in Firebase Console**

---

## Performance Tips

### Optimize Generation Speed

**1. Parallel Processing (2 servers):**

```bash
# Terminal 1 - Server 1
npm run backfill-images chicago-bulls

# Terminal 2 - Server 2
npm run backfill-images israeli-news
```

**2. Adjust HD based on need:**

```typescript
// Fast (no HD): ~20-30s per image
HD_MODE: false

// Slow (HD): ~30-60s per image
HD_MODE: true
```

**3. Process in batches:**

```bash
# Process 10 at a time
npm run backfill-images chicago-bulls --limit 10

# Then next 10
npm run backfill-images chicago-bulls --limit 10 --no-skip
```

---

## API Reference

### generateAIImage

```typescript
import { generateAIImage } from '@/lib/media/aiImageGenerator';

const result = await generateAIImage({
  title: 'Derrick Rose MVP Season',
  summary: 'Analysis of his 2011 season...',
  artisticStyle: 'hyperrealistic',  // optional
  enableHiresFix: true               // optional
});

// result = {
//   success: true,
//   imageUrl: 'data:image/png;base64,...',
//   prompt: 'Derrick Rose in Chicago Bulls...'
// }
```

### uploadHeroImage

```typescript
import { uploadHeroImage } from '@/lib/media/uploadHeroImage';

const firebaseUrl = await uploadHeroImage({
  base64Image: 'data:image/png;base64,...',
  itemId: 'clx123abc',
  patchHandle: 'chicago-bulls',      // optional
  storageType: 'backfill'            // optional
});

// firebaseUrl = 'https://firebasestorage.googleapis.com/...'
```

### tryFallbackImage

```typescript
import { tryFallbackImage } from '@/lib/media/fallbackImages';

const fallback = await tryFallbackImage({
  title: 'Derrick Rose',
  content: 'Article about...',       // optional
  sourceUrl: 'https://...'           // optional
});

// fallback = {
//   success: true,
//   imageUrl: 'https://commons.wikimedia.org/...',
//   source: 'wikimedia'
// }
```

---

## File Structure

```
carrot/
├── src/
│   ├── config/
│   │   └── discovery.ts                    # Configuration
│   ├── lib/
│   │   └── media/
│   │       ├── aiImageGenerator.ts         # AI generation (existing)
│   │       ├── uploadHeroImage.ts          # Firebase upload helper
│   │       └── fallbackImages.ts           # Fallback sources
│   └── app/
│       └── api/
│           └── content/
│               └── route.ts                # Auto-generation integration
├── scripts/
│   └── backfill-hero-images.ts             # Backfill script
├── docs/
│   └── HERO-IMAGE-INTEGRATION.md           # This file
└── package.json                             # npm scripts
```

---

## Next Steps

### Recommended Workflow

1. **Test with one patch:**

```bash
npm run backfill-images chicago-bulls --limit 5
```

2. **Verify images appear** on `/patch/chicago-bulls`

3. **Process remaining items:**

```bash
npm run backfill-images chicago-bulls
```

4. **Enable auto-discovery** (already enabled by default)

5. **Monitor new discoveries** - they'll get images automatically!

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review configuration in `src/config/discovery.ts`
3. Check logs for detailed error messages
4. Verify VAST AI is running: `curl http://localhost:30401/health`

---

**🎉 Hero Image Integration Complete!**

All new discoveries will automatically get high-quality hero images, and you can backfill existing content page-by-page as needed.

Last updated: October 16, 2025  
Maintained by: Carrot Engineering  
Status: Production Ready ✅

