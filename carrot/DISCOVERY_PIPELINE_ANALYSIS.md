# Discovery Pipeline Analysis & Fix Plan

## Executive Summary

The discovery pipeline is failing due to **multiple code paths** running simultaneously, with the old `DiscoveryOrchestrator` still being used despite `DISCOVERY_V21: true`. The old orchestrator has abort logic that prevents discovery from proceeding when seed diversity is low.

## Root Cause Analysis

### Issue 1: Dual Discovery Runs
**Evidence from logs:**
- Run ID `cmigkp4ss0001jl2bsfx77nz2`: DiscoveryEngineV21 (correct, working)
- Run ID `cmigkp54i000bjl2bu6kghdes`: DiscoveryOrchestrator (old, failing)

**Problem:** Two discovery runs are being created for the same patch, and the old orchestrator is failing with seed diversity error.

**Location:** 
- `carrot/src/lib/discovery/orchestrator.ts:427` - Old abort logic
- `carrot/src/lib/discovery/engine.ts:42-44` - Feature flag routing

### Issue 2: Old Orchestrator Still Has Abort Logic
**Code Location:** `carrot/src/lib/discovery/orchestrator.ts:300-430`

The old `DiscoveryOrchestrator.seedFrontierFromPlanner()` method:
- Line 408: Uses `DISCOVERY_MIN_UNIQUE_DOMAINS` (defaults to 5)
- Line 425-428: **Throws error if < minUniqueDomains** (currently 8 from env, but defaults to 5)
- **No fallback logic** - just aborts

**Contrast with new planner:**
- `carrot/src/lib/discovery/planner.ts:1263-1427` - `seedFrontierFromPlan()` has:
  - Static seed fallback (line 1297-1310)
  - `MIN_UNIQUE_DOMAINS_ABSOLUTE = 5` (line 1266)
  - **Never aborts** (line 1427: "NEVER abort - always proceed")

### Issue 3: Missing Stop Endpoint (404 Error)
**Evidence:** Log shows `[POST]404 /api/patches/chicago-bulls/discovery/stop`

**Status:** The endpoint actually EXISTS at `carrot/src/app/api/patches/[handle]/discovery/stop/route.ts`

**Possible causes:**
1. Route not properly registered in Next.js
2. Route path mismatch
3. Build/deployment issue

### Issue 4: Empty Discovery Results
**Evidence:** API returns `success: true` but `itemsCount: 0`, `reasonWhenEmpty: 'no_content_discovered'`

**Root cause:** Discovery aborts early due to seed diversity check, so no items are saved.

## Code Flow Analysis

### Current Flow (Broken)
```
1. POST /api/patches/[handle]/start-discovery
   ├─> Checks DISCOVERY_V21 flag (true)
   ├─> Creates DiscoveryRun (runId: cmigkp4ss0001jl2bsfx77nz2)
   ├─> Calls seedFrontierFromPlan() [planner.ts] ✅ Has fallback
   ├─> Calls runOpenEvidenceEngine()
   │   ├─> isDiscoveryV21Enabled() = true
   │   └─> Creates DiscoveryEngineV21 ✅ Correct
   │
   └─> BUT ALSO: Somehow creates DiscoveryOrchestrator ❌
       └─> Calls initializeFrontier()
           └─> Calls seedFrontierFromPlanner() [orchestrator.ts]
               └─> Throws error if < 8 unique domains ❌ ABORTS
```

### Expected Flow (Fixed)
```
1. POST /api/patches/[handle]/start-discovery
   ├─> Checks DISCOVERY_V21 flag (true)
   ├─> Creates DiscoveryRun
   ├─> Calls seedFrontierFromPlan() [planner.ts] ✅ Has fallback
   ├─> Calls runOpenEvidenceEngine()
   │   └─> Creates DiscoveryEngineV21 ONLY ✅
   │       └─> Uses frontier already seeded by route
   │
   └─> DiscoveryEngineV21 processes items ✅
```

## Detailed Issues

### Issue 1.1: Why is Old Orchestrator Being Created? ✅ FOUND

**Root Cause:** Legacy code path in stream route

**Location:** `carrot/src/app/api/patches/[handle]/discovery/stream/route.ts:105-180`

**Problem:** 
- When `OPEN_EVIDENCE_V2` is false, the stream route uses legacy code path
- This creates a NEW `DiscoveryOrchestrator` instance (line 146)
- This creates a SECOND discovery run with different runId
- The old orchestrator then fails with seed diversity error

**Code Flow:**
```
1. POST /start-discovery
   └─> Creates runId: cmigkp4ss0001jl2bsfx77nz2
   └─> Uses DiscoveryEngineV21 ✅

2. GET /discovery/stream?runId=...
   └─> If OPEN_EVIDENCE_V2 = false (legacy path)
       └─> Creates NEW runId: cmigkp54i000bjl2bu6kghdes ❌
       └─> Creates DiscoveryOrchestrator ❌
           └─> Calls seedFrontierFromPlanner()
               └─> Throws error (aborts) ❌
```

**Fix:** Update stream route to use event bus even when OPEN_EVIDENCE_V2 is false, OR check DISCOVERY_V21 flag instead

### Issue 1.2: Old Orchestrator Abort Logic

**Current code (orchestrator.ts:425-428):**
```typescript
if (finalUniqueDomainCount < minUniqueDomains) {
  throw new Error(
    `Failed to generate sufficient seed diversity: only ${finalUniqueDomainCount} unique domains (minimum: ${minUniqueDomains})`
  )
}
```

**Should be:** Use fallback logic like planner.ts does

### Issue 2: Stop Endpoint 404

**File exists:** `carrot/src/app/api/patches/[handle]/discovery/stop/route.ts`

**Possible issues:**
1. Next.js route not matching (path structure)
2. Route file not included in build
3. Deployment issue

**Action needed:** Verify route is accessible and properly exported

## Fix Plan

### Phase 1: Immediate Fixes (Critical)

#### Fix 1.1: Remove Abort Logic from Old Orchestrator
**File:** `carrot/src/lib/discovery/orchestrator.ts`
**Action:** Update `seedFrontierFromPlanner()` to use fallback logic instead of aborting

**Changes:**
1. Import `getStaticBullsSeeds` from `./staticSeeds`
2. If `finalUniqueDomainCount < 10`, add static seeds
3. Remove the throw statement (lines 425-428)
4. Add warning log instead of error

#### Fix 1.2: Ensure Only DiscoveryEngineV21 is Used
**File:** `carrot/src/lib/discovery/engine.ts`
**Action:** Add guard to prevent old orchestrator from being created

**Changes:**
1. Add explicit check: if `DISCOVERY_V21` is true, NEVER create old orchestrator
2. Add logging to track which engine is being used
3. If old orchestrator is requested but V21 is enabled, throw error

#### Fix 1.3: Verify Stop Endpoint
**File:** `carrot/src/app/api/patches/[handle]/discovery/stop/route.ts`
**Action:** Verify route is properly configured

**Checks:**
1. Export is correct
2. Route path matches expected pattern
3. File is included in build

### Phase 2: Code Cleanup (High Priority)

#### Fix 2.1: Remove or Deprecate Old Orchestrator
**Action:** 
1. Mark `DiscoveryOrchestrator` as deprecated
2. Add warning logs when it's instantiated
3. Plan for removal once V21 is stable

#### Fix 2.2: Consolidate Seed Logic
**Action:**
1. Ensure all seed logic uses `seedFrontierFromPlan()` from planner.ts
2. Remove duplicate seed logic from orchestrator.ts
3. Make orchestrator.ts use planner.ts functions

### Phase 3: Testing & Validation

#### Test 3.1: Verify Single Run
**Action:**
1. Start discovery
2. Check logs for only ONE run ID
3. Verify it's DiscoveryEngineV21, not DiscoveryOrchestrator

#### Test 3.2: Verify Seed Fallback
**Action:**
1. Test with low seed diversity (3 domains)
2. Verify discovery proceeds (doesn't abort)
3. Verify static seeds are added

#### Test 3.3: Verify Stop Endpoint
**Action:**
1. Start discovery
2. Call stop endpoint
3. Verify 200 response (not 404)

## Implementation Steps

### Step 1: Fix Stream Route Legacy Path (CRITICAL)
1. Open `carrot/src/app/api/patches/[handle]/discovery/stream/route.ts`
2. Update legacy path (lines 105-180) to check `DISCOVERY_V21` flag
3. If `DISCOVERY_V21` is true, use event bus (don't create old orchestrator)
4. If `DISCOVERY_V21` is false, keep legacy path but fix abort logic

### Step 2: Fix Old Orchestrator Abort Logic
1. Open `carrot/src/lib/discovery/orchestrator.ts`
2. Find `seedFrontierFromPlanner()` method (line 300)
3. Replace abort logic (lines 425-428) with fallback logic
4. Import static seeds helper
5. Add static seeds when diversity is low

### Step 2: Add Guard in Engine Factory
1. Open `carrot/src/lib/discovery/engine.ts`
2. Add explicit check before creating old orchestrator
3. Add logging
4. Throw error if old orchestrator requested but V21 enabled

### Step 3: Verify Stop Endpoint
1. Check route file exists and is correct
2. Test locally
3. Verify in production logs

### Step 4: Fix All Orchestrator Instantiations
**Found 4 locations:**
1. ✅ `engine.ts:44` - Already uses feature flag (correct)
2. ❌ `discovery/stream/route.ts:146` - Legacy path, needs fix (CRITICAL)
3. ✅ `start-discovery/route.ts:330` - BullsDiscoveryOrchestrator (different, OK)
4. ✅ `oneAtATimeWorker.ts:30` - BullsDiscoveryOrchestrator (different, OK)

**Action:** Fix stream route only

### Step 5: Test & Deploy
1. Test discovery with low seed diversity
2. Verify only one run is created
3. Verify discovery proceeds (doesn't abort)
4. Deploy and monitor logs

## Success Criteria

1. ✅ Only ONE discovery run is created per start request
2. ✅ DiscoveryEngineV21 is used (not old orchestrator)
3. ✅ Discovery proceeds even with low seed diversity (3 domains)
4. ✅ Static seeds are added when LLM returns < 10 unique domains
5. ✅ Stop endpoint returns 200 (not 404)
6. ✅ Discovery saves items (not empty results)

## Risk Assessment

**Low Risk:**
- Fixing abort logic (just changing error to warning + fallback)
- Adding guard in engine factory (defensive coding)

**Medium Risk:**
- Modifying old orchestrator (could break legacy code paths)
- **Mitigation:** Add feature flag to enable/disable old orchestrator entirely

**High Risk:**
- Removing old orchestrator completely
- **Mitigation:** Keep it but make it use new planner logic

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 fixes
3. Test locally
4. Deploy to staging
5. Monitor logs
6. Deploy to production

