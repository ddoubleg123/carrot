# Automatic Self-Auditing Summary

## ✅ Fixed: API Connection Issue

The scripts now automatically detect the environment:
- **Local:** Tries `http://localhost:3000` first, falls back to production
- **Server:** Uses `NEXTAUTH_URL` or production URL

This means scripts work both locally (if dev server running) and on production.

## 🔄 When Automatic Self-Auditing Runs

### 1. **During Discovery (Every Time)**
**Location:** `orchestrator.ts` line 1569-1592

**Trigger:** Immediately after content is saved during discovery

**What happens:**
```typescript
Content saved → Check if hero missing/placeholder → 
  → If yes: Automatically call enrichContentId()
  → Enrichment worker generates hero image
  → Database updated
```

**Frequency:** **Every discovery run** - happens automatically, no manual trigger needed

### 2. **During Citation Processing**
**Location:** `process-all-citations-enhanced.ts` line 208-220

**Trigger:** When processing Wikipedia citations

**Frequency:** When running citation processing

### 3. **During Content Enrichment**
**Location:** `enrichment/worker.ts`

**Trigger:** When `enrichContentId()` is called

**Frequency:** 
- Automatically during discovery
- When manually calling enrichment API
- When content preview triggers enrichment

## 📋 What Gets Automatically Checked

### Hero Images ✅
- Missing hero → Auto-generates
- Placeholder hero → Auto-generates  
- Skeleton/SVG hero → Auto-generates

### Grammar/Quality ✅
- Quality score < 60 → Logged (rejected during discovery)
- Grammar issues → Logged during enrichment
- Low quality → Can be re-processed manually

## 🎯 For Anna's Archive Content

Anna's Archive content goes through the **exact same pipeline** as Wikipedia:

1. Content extracted from Anna's Archive
2. DeepSeek enrichment (grammar checked)
3. Hero image generated via `heroPipeline.assignHero()` 
4. **If hero missing/placeholder → Auto-triggers `enrichContentId()`**
5. Hero image generated and saved

**Result:** Anna's Archive content gets hero images automatically, just like Wikipedia!

## 🚀 Manual Audits (When Needed)

Run these to fix existing content:

```bash
# Fix hero images
npx tsx scripts/self-audit-hero-images.ts israel

# Fix grammar/quality
npx tsx scripts/self-audit-grammar-quality.ts israel

# Fix both
npx tsx scripts/self-audit-all.ts israel
```

**When to run manually:**
- After bulk imports
- Weekly maintenance
- To fix existing content with issues

## 📊 Monitoring

Watch logs for:
- `[Orchestrator] 🎨 Hero image missing/placeholder` → Auto-triggered
- `[Orchestrator] ✅ Self-audit generated hero image` → Success
- `[Enrich Content] ⚠️  Quality/grammar issues detected` → Issue found

## ✨ Bottom Line

**You don't need to do anything!** The system automatically:
- ✅ Generates hero images for all new content (including Anna's Archive)
- ✅ Checks grammar/quality during enrichment
- ✅ Fixes missing heroes automatically during discovery

Manual audits are only needed to fix **existing** content that was created before this system was in place.

