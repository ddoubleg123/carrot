# TODO List - Citation & Agent Learning System

## 🔴 Critical Priority (Fix Before Next Deployment)

### 1. Deploy Title Extraction Fix ✅ CODE READY
- **Status**: Fixed in code, needs deployment
- **File**: `carrot/src/lib/discovery/wikipediaProcessor.ts` (line 1495)
- **Change**: Use `extractedTitle` instead of `nextCitation.citationTitle`
- **Action**: 
  - [ ] Deploy to Render
  - [ ] Verify new citations get proper titles
  - [ ] Run backfill script for existing items

### 2. Backfill Existing "Untitled" Items
- **Status**: Script ready
- **File**: `carrot/scripts/backfill-untitled-titles.ts`
- **Action**:
  - [ ] Test script: `npx tsx scripts/backfill-untitled-titles.ts --patch=israel`
  - [ ] Run live: `npx tsx scripts/backfill-untitled-titles.ts --patch=israel --live`
  - [ ] Verify titles updated in database
  - [ ] Check frontend shows correct titles

### 3. Fix Agent Memory Creation
- **Status**: Code fixed, needs verification
- **Issue**: AgentMemory entries missing `discoveredContentId`/`patchId` fields
- **Action**:
  - [ ] Verify feed worker fix is deployed
  - [ ] Check if new AgentMemory entries have discovery fields
  - [ ] Run: `npx tsx scripts/check-live-system-status.ts`
  - [ ] If still broken, investigate `feedWorker.ts`

### 4. Backfill Existing AgentMemory Entries
- **Status**: Needs script creation
- **Issue**: 18 existing entries missing `discoveredContentId`/`patchId`
- **Action**:
  - [ ] Create script to backfill missing fields
  - [ ] Link AgentMemory to DiscoveredContent by content hash or URL
  - [ ] Update 18 existing entries
  - [ ] Verify links are correct

## 🟡 High Priority (Fix This Week)

### 5. Investigate Missing Citation Heroes
- **Status**: Needs investigation
- **Issue**: 42 saved citations but only 33 heroes from citations (9 missing)
- **Action**:
  - [ ] Query: Find saved citations without DiscoveredContent
  - [ ] Check if they failed during save process
  - [ ] Check if they're in a different patch
  - [ ] Create missing DiscoveredContent entries if needed

### 6. Set Up Automatic Feed Worker
- **Status**: Code ready, needs deployment
- **File**: `carrot/scripts/auto-feed-worker.ts`
- **Action**:
  - [ ] Set up cron job on Render (every 5 minutes)
  - [ ] Or configure as background service
  - [ ] Test: `curl https://carrot-app.onrender.com/api/agent-feed/process-all`
  - [ ] Monitor logs for processing

### 7. Verify Frontend Title Display
- **Status**: Needs verification after backfill
- **Action**:
  - [ ] After backfilling titles, check frontend
  - [ ] Verify API returns correct titles: `/api/patches/israel/discovered-content`
  - [ ] Check `DiscoveryCard` component receives titles
  - [ ] Fix if titles still not showing

## 🟢 Medium Priority (Fix This Month)

### 8. Improve Title Extraction Fallbacks
- **Status**: Enhancement needed
- **Action**:
  - [ ] Add better fallback when HTML extraction fails
  - [ ] Use URL path as fallback
  - [ ] Use domain name as fallback
  - [ ] Use first sentence of content as fallback

### 9. Add Monitoring & Alerts
- **Status**: Needs setup
- **Action**:
  - [ ] Monitor feed queue lag
  - [ ] Alert if AgentMemory not being created
  - [ ] Alert if too many "Untitled" items
  - [ ] Dashboard for system health

### 10. Test End-to-End Flow
- **Status**: Needs comprehensive testing
- **Action**:
  - [ ] Test: Citation extraction → Content saving → Agent feeding → Frontend display
  - [ ] Verify titles flow through entire pipeline
  - [ ] Verify AgentMemory is created correctly
  - [ ] Verify heroes appear on frontend with correct titles

## 📋 Verification Checklist (After Deployment)

- [ ] New citations get proper titles (not "Untitled")
- [ ] Existing "Untitled" items updated with real titles
- [ ] Frontend shows correct titles on hero cards
- [ ] AgentMemory entries created with `discoveredContentId`/`patchId`
- [ ] Feed queue processing automatically
- [ ] All 42 saved citations have corresponding heroes
- [ ] Agent learning from all discovered content

## 🔧 Scripts Available

1. **Check System Status**: `npx tsx scripts/check-live-system-status.ts`
2. **Check Hero Titles**: `npx tsx scripts/check-hero-titles.ts --patch=israel`
3. **Check Citation Titles**: `npx tsx scripts/check-citation-titles.ts --patch=israel`
4. **Backfill Titles**: `npx tsx scripts/backfill-untitled-titles.ts --patch=israel --live`
5. **Verify Agent Feed**: `npx tsx scripts/verify-agent-feed-system.ts`

## 📊 Current Metrics

- **External Citations**: 2,926 ✅
- **Saved Citations**: 42 ✅
- **DiscoveredContent**: 51 (33 from citations, 18 from web)
- **AgentMemory (with fields)**: 0 ❌
- **Heroes with Titles**: 0 ❌ (all showing "Untitled")

## 🎯 Success Criteria

1. ✅ All heroes show proper titles (not "Untitled")
2. ✅ All saved citations have corresponding heroes
3. ✅ AgentMemory entries created for all DiscoveredContent
4. ✅ Feed worker runs automatically every 5 minutes
5. ✅ End-to-end flow works: Citation → Content → Agent → Frontend

