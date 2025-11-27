# Phase 1 Fixes - Implementation Summary

## Fixes Implemented

### ✅ Fix 1: Stream Route Legacy Path (CRITICAL)
**File:** `carrot/src/app/api/patches/[handle]/discovery/stream/route.ts`

**Problem:** Legacy code path was creating a second `DiscoveryOrchestrator` instance when `OPEN_EVIDENCE_V2` was false, even when `DISCOVERY_V21` was true. This caused:
- Duplicate discovery runs
- Old orchestrator failing with seed diversity error
- Discovery appearing to fail

**Solution:**
- Updated condition to check `DISCOVERY_V21` flag in addition to `OPEN_EVIDENCE_V2`
- When `DISCOVERY_V21` is enabled, require `runId` parameter and use event bus (don't create new orchestrator)
- Legacy path (creating old orchestrator) only used when BOTH flags are false

**Changes:**
- Added `isDiscoveryV21Enabled()` import
- Updated condition: `if (openEvidenceEnabled || discoveryV21Enabled)`
- Added separate handling for `discoveryV21Enabled` case that uses event bus
- Legacy path now only runs when both flags are false

### ✅ Fix 2: Old Orchestrator Abort Logic
**File:** `carrot/src/lib/discovery/orchestrator.ts`

**Problem:** Old orchestrator was throwing an error when seed diversity was low (< 8 unique domains), causing discovery to abort.

**Solution:**
- Replaced `throw new Error()` with fallback seed logic
- Added import for `getStaticBullsSeeds()`
- When diversity is low, automatically add static Bulls seeds
- Never abort - always proceed with available seeds (with warning)

**Changes:**
- Added `getStaticBullsSeeds` import
- Replaced abort logic (lines 425-428) with fallback seed addition
- Added logging for fallback seed addition
- Changed from error to warning when diversity is still low after fallback

### ✅ Fix 3: Stop Endpoint Runtime Export
**File:** `carrot/src/app/api/patches/[handle]/discovery/stop/route.ts`

**Problem:** Stop endpoint was returning 404, possibly due to missing runtime export.

**Solution:**
- Added `export const runtime = 'nodejs'` to ensure proper Next.js route registration

**Changes:**
- Added runtime export declaration

## Expected Results

After these fixes:

1. **Single Discovery Run:** Only one discovery run will be created per start request
2. **No Abort Errors:** Discovery will proceed even with low seed diversity (3 domains)
3. **Fallback Seeds:** Static Bulls seeds will be automatically added when LLM returns < 10 unique domains
4. **Stop Endpoint Works:** Stop endpoint should return 200 (not 404)
5. **Discovery Saves Items:** Discovery should save items instead of returning empty results

## Testing Checklist

- [ ] Start discovery and verify only ONE run ID in logs
- [ ] Verify run uses DiscoveryEngineV21 (not old orchestrator)
- [ ] Test with low seed diversity (3 domains) - should proceed without error
- [ ] Verify static seeds are added when diversity is low
- [ ] Test stop endpoint - should return 200
- [ ] Verify discovery saves items (not empty results)

## Next Steps

1. Deploy these fixes to staging
2. Monitor logs for:
   - Single run creation
   - No abort errors
   - Successful item saves
3. If successful, deploy to production
4. Continue with Phase 2 (code cleanup) if needed

