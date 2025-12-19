# System Status & TODO List

## 🔍 Current System Status (Live on Render)

### ✅ What's Working

1. **Citation Extraction**: ✅ Working
   - 2,926 external citations stored
   - 0 Wikipedia links (correctly filtered)
   - 30 Wikipedia pages monitored

2. **Content Saving**: ✅ Working
   - 51 DiscoveredContent items saved
   - 33 from Wikipedia citations
   - 18 from web discovery

3. **Feed Queue**: ✅ Working
   - All 51 items processed (DONE)
   - Queue is healthy

4. **Heroes Visible**: ⚠️  Partially Working
   - 51 items exist in database
   - All have titles in database
   - BUT: Frontend showing "Untitled" for all items

### ❌ What's NOT Working

1. **Agent Learning**: ❌ NOT Working
   - 0 AgentMemory entries with `discoveredContentId`/`patchId`
   - 18 entries exist but missing discovery fields
   - Feed worker fix deployed but needs verification

2. **Hero Titles on Frontend**: ✅ FIXED (needs deployment)
   - All heroes showing as "Untitled" on frontend
   - Root cause: Using `citationTitle` instead of `extractedTitle` from HTML
   - Fix: Updated to use `extractedTitle` which is extracted from actual content
   - Action: Deploy fix and backfill existing items

3. **Missing Citation Heroes**: ⚠️  Partial
   - 42 saved citations → should have 42 heroes
   - Currently: 33 heroes from citations
   - 9 missing (may be processing or failed)

## 📋 TODO List

### 🔴 Critical (Fix Immediately)

1. **Fix Title Extraction for Citations** ✅ FIXED
   - Status: ✅ Fixed - Now using `extractedTitle` from HTML extraction
   - Issue: Was using `nextCitation.citationTitle` instead of `extractedTitle` from content
   - Location: `wikipediaProcessor.ts` line 1495
   - Fix: Changed to use `extractedTitle || nextCitation.citationTitle || 'Untitled'`
   - Action: Deploy fix and backfill existing "Untitled" items
   - Priority: HIGH

2. **Fix Agent Memory Creation**
   - Status: ✅ Fixed in code (deployed)
   - Issue: Feed worker was creating duplicate memories
   - Fix: Updated to create directly with discovery fields
   - Action: Verify fix is working after deployment
   - Priority: HIGH

3. **Update Existing AgentMemory Entries**
   - Status: ⚠️  Pending
   - Issue: 18 existing entries missing `discoveredContentId`/`patchId`
   - Action: Create script to backfill missing fields
   - Priority: MEDIUM

### 🟡 Important (Fix Soon)

4. **Fix Missing Citation Heroes**
   - Status: ⚠️  9 missing (33 vs 42 expected)
   - Issue: Some saved citations not creating DiscoveredContent
   - Action: Investigate why 9 citations didn't create heroes
   - Priority: MEDIUM

5. **Set Up Automatic Feed Worker**
   - Status: ⚠️  Code ready, needs deployment
   - Issue: Feed worker not running automatically on Render
   - Action: Set up cron job or background service
   - Priority: MEDIUM

6. **Fix Frontend Title Display**
   - Status: ⚠️  Titles exist but showing as "Untitled"
   - Issue: Frontend may not be receiving titles correctly
   - Action: Check API response and frontend mapping
   - Priority: MEDIUM

### 🟢 Nice to Have

7. **Improve Title Extraction**
   - Better fallbacks when title extraction fails
   - Use URL, domain, or content summary as fallback
   - Priority: LOW

8. **Add Title Backfill Script**
   - Update existing "Untitled" items with better titles
   - Extract from content or URL
   - Priority: LOW

## 🎯 Immediate Actions Needed

1. **Investigate Title Extraction**
   - Check `processNextCitation` in `wikipediaProcessor.ts`
   - See why titles are coming through as empty/null
   - Fix extraction logic

2. **Verify Agent Memory Fix**
   - After deployment, check if new memories have discovery fields
   - Run verification script

3. **Backfill Existing Memories**
   - Update 18 existing AgentMemory entries
   - Add missing `discoveredContentId`/`patchId` fields

4. **Set Up Feed Worker**
   - Configure cron job on Render
   - Or set up background service

## 📊 Expected vs Actual

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| External Citations | - | 2,926 | ✅ |
| Saved Citations | - | 42 | ✅ |
| DiscoveredContent | 42 | 51 | ⚠️  (33 from citations) |
| AgentMemory (with fields) | 51 | 0 | ❌ |
| Heroes with Titles | 51 | 0 | ❌ |

## 🔧 Next Steps

1. Fix title extraction in citation processing
2. Verify agent memory fix is working
3. Backfill existing AgentMemory entries
4. Set up automatic feed worker
5. Test end-to-end flow

