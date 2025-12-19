# Hero Title & Image Fix - TODO List

## Current Status (from Audit)

- **Total DiscoveredContent**: 1,184 items
- **With Hero records**: 274 (23.1%)
- **Without Hero records**: 910 (76.9%)
- **Hero status**: 18 READY (6.6%), 256 ERROR (93.4%)
- **Poor titles**: 24 items (2.0%)
- **Images**: 18 real (6.6%), 56 placeholder (20.4%), 200 missing (73.0%)

## Issues Identified

1. **Frontend not showing updated titles** - Titles still show DOIs, "book part", "Untitled"
2. **CSP blocking images** - Content Security Policy errors in console
3. **Hero generation failing** - 256 heroes in ERROR status with "Referrer 'no-referrer' is not a valid URL" error
4. **Missing heroes** - 910 items without Hero records
5. **Poor titles** - 24 items still have poor titles

## TODO List

### 🔴 Critical (Frontend Issues)

- [ ] **Fix CSP for hero images** - Add missing domains to `img-src` directive in `next.config.js`
  - Check what domains hero images are coming from (Firebase, Wikimedia, etc.)
  - Add `via.placeholder.com` if not already there
  - Test that images load after CSP update

- [ ] **Verify API returns updated titles** - Check `/api/patches/[handle]/discovered-content` endpoint
  - Ensure it's reading from `DiscoveredContent.title` (not cached)
  - Verify title updates are reflected immediately
  - Check if there's caching that needs to be cleared

- [ ] **Fix hero enrichment errors** - 256 heroes failing with "Referrer 'no-referrer' is not a valid URL"
  - Check `fetchDeepLink` function in `enrichment/worker.ts`
  - Fix referrer header issue
  - Retry failed heroes

### 🟡 High Priority (Data Quality)

- [ ] **Generate missing heroes** - 910 items without Hero records
  - Run `fix-hero-titles-and-images.ts` to trigger enrichment
  - Or create batch script to call `enrichContentId` for all items without heroes
  - Monitor progress and errors

- [ ] **Fix remaining poor titles** - 24 items still have poor titles
  - Run improved title extraction on these items
  - Use Hero table titles if better
  - Extract from URLs as fallback

- [ ] **Link AgentMemory** - 8,787 entries not linked to DiscoveredContent
  - Run `backfill-agent-memory.ts` script
  - Ensure all future memories are linked

### 🟢 Medium Priority (Optimization)

- [ ] **Investigate hero generation failures** - Why are 93.4% failing?
  - Check error messages in Hero table
  - Review `enrichContentId` function
  - Fix root cause of failures
  - Set up monitoring/alerting

- [ ] **Improve title extraction** - Prevent future poor titles
  - Enhance `wikipediaProcessor.ts` title extraction
  - Add validation before saving
  - Use AI to improve titles if needed

- [ ] **Add CSP monitoring** - Track CSP violations
  - Log CSP errors to monitoring system
  - Alert when new domains need to be added

## Implementation Steps

### Step 1: Fix CSP (Immediate)
1. Check hero image URLs in database
2. Add missing domains to `next.config.js` CSP `img-src`
3. Deploy and test

### Step 2: Fix Hero Enrichment Errors
1. Fix referrer header issue in `fetchDeepLink`
2. Retry all ERROR status heroes
3. Monitor success rate

### Step 3: Generate Missing Heroes
1. Create script to batch-enrich all items without heroes
2. Run script and monitor progress
3. Verify heroes appear on frontend

### Step 4: Fix Titles
1. Run title fix script on remaining 24 items
2. Verify titles update on frontend
3. Test that new content gets good titles

### Step 5: Link AgentMemory
1. Run backfill script
2. Verify linking works
3. Ensure future memories are linked

## Testing Checklist

- [ ] Images load without CSP errors
- [ ] Titles show correctly (no DOIs, "Untitled", "book part")
- [ ] Heroes display on frontend
- [ ] No console errors
- [ ] API returns correct data
- [ ] New content gets good titles and heroes

## Notes

- Hero images are generated asynchronously - may take time
- CSP errors block images from loading - must fix first
- Title updates may require cache clearing
- Hero enrichment failures need root cause analysis

