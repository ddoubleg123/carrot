# Discovery Issues Analysis - Nov 27, 2025

## Problems Identified

### 1. Discovery Running But Not Saving Items
**Symptoms:**
- Discovery is running (`run_start` event logged)
- Processing candidates (`processed: 36`)
- But `saved: 0` consistently
- Some URLs extract content (2327, 1409, 3669 chars) but still not saved

**Root Causes:**
- **Playwright browsers not installed**: Render build hasn't run with new postinstall script yet
- **extractor_empty errors**: Many URLs return 0 chars because Playwright render fails
- **Summary pages being skipped**: Directory/listing pages are skipped (`summary_skipped`)
- **Content length filtering**: Items need ≥400 chars to be saved (MIN_CHARS_PARTIAL)

**Evidence from logs:**
```
"chars":0,"paras":0  // Many URLs extracting 0 chars
"extractor_empty"     // All branches failing
"summary_skipped"     // Directory pages being skipped
"saved":0             // No items being saved despite processing
```

### 2. Frontend Not Showing Saved Items
**Symptoms:**
- 454 saved sources in database
- Frontend shows "Waiting for first card..."
- API returns `itemsCount: 0`

**Root Causes:**
- **API filtering by textBytes**: API filters `textBytes >= 200`, but saved items might not have `textContent` populated
- **Missing textContent**: Old saved items might not have `textContent` field populated (schema change)

**Evidence:**
- API query filters: `textContent: { not: null }` AND `textBytes >= 200`
- Old saved items might have `textContent: null`

### 3. Playwright Browsers Not Installed
**Symptoms:**
```
browserType.launch: Executable doesn't exist at /opt/render/.cache/ms-playwright/chromium-1140/chrome-linux/chrome
```

**Root Causes:**
- Postinstall script has `|| true` which hides errors
- Render build might not be running postinstall
- Need to ensure Playwright installs during build

**Solution:**
- `render.yaml` already has `npx playwright install --with-deps chromium` in buildCommand
- Next deploy should install browsers
- Remove `|| true` from postinstall to see errors

## Fixes Needed

### Fix 1: Ensure Playwright Installs During Build
**File:** `carrot/package.json`
- Remove `|| true` from postinstall to see errors
- Or ensure `render.yaml` buildCommand includes playwright install (already does)

### Fix 2: Fix API Filtering for Old Items
**File:** `carrot/src/app/api/patches/[handle]/discovered-content/route.ts`
- Don't filter by `textBytes >= 200` if item has `heroRecord` (already has hero)
- Or backfill `textContent` for old items

### Fix 3: Investigate Why Items With Content Aren't Saved
**Need to check:**
- Are items with 2327, 1409, 3669 chars passing the 400 char minimum?
- Are they being filtered out by other checks (vetter, acceptance, etc.)?
- Check logs for `saved: false` reasons for these items

### Fix 4: Backfill textContent for Old Items
**Action:**
- Create migration/script to backfill `textContent` from `summary` or other fields for old items
- Or update API to not require `textContent` if item has hero

## Immediate Actions

1. **Deploy current fixes** (extractor_empty handling, Playwright postinstall)
2. **Check Render build logs** to verify Playwright installs
3. **Query database** to check if saved items have `textContent` populated
4. **Update API** to show items without `textContent` if they have heroes
5. **Backfill textContent** for old saved items

## Database Query to Check

```sql
-- Check saved items without textContent
SELECT COUNT(*) 
FROM "DiscoveredContent" 
WHERE "patchId" = 'cmgnz2p5l0001qe29l4ziitf7' 
  AND "textContent" IS NULL;

-- Check saved items with textContent < 200 bytes
SELECT COUNT(*) 
FROM "DiscoveredContent" 
WHERE "patchId" = 'cmgnz2p5l0001qe29l4ziitf7' 
  AND "textContent" IS NOT NULL 
  AND LENGTH("textContent") < 200;
```

