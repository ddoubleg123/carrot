# Discovery Engine Fix Plan

## Current Issues

### 1. **Playwright Not Installed** (CRITICAL)
- **Problem**: Playwright browsers not installing during Render build
- **Impact**: All JS-rendered pages fail extraction → 0 items saved
- **Evidence**: Logs show `browserType.launch: Executable doesn't exist`

### 2. **Zero-Save Auto-Pause Too Aggressive**
- **Problem**: Discovery pauses after 40 attempts even if only running 11 seconds
- **Status**: ✅ FIXED - Now requires 2+ minutes runtime before pausing
- **Note**: Log message still says "pause" but it's just a warning

### 3. **Reseed Circuit Breaker Stops Discovery**
- **Problem**: Discovery stops after 10 reseed attempts
- **Status**: ✅ FIXED - Now logs warning but continues running

### 4. **Misleading Log Messages**
- **Problem**: Log says "zero-save pause@40 attempts" but it's just a warning
- **Status**: ✅ FIXED - Changed to "warning" message

### 5. **Hero Images Not Displaying**
- **Problem**: Wikimedia/AI hero images not showing in frontend
- **Status**: ✅ FIXED - Added wikimedia source detection

### 6. **Saved Items Not Showing**
- **Problem**: 454 saved items not appearing in UI
- **Status**: ✅ FIXED - Relaxed API filtering to show all items with titles

## Fix Plan

### Phase 1: Playwright Installation (IMMEDIATE) ✅

**Changes Made:**
1. Enhanced `render.yaml` build command:
   - Double install attempt: `npx playwright install --with-deps chromium` (with deps)
   - Fallback: `npx playwright install chromium` (without deps if first fails)
   - Added error handling to continue build even if install fails

2. Added verification script:
   - `scripts/verify-playwright.mjs` - Checks if Playwright is installed
   - `npm run verify:playwright` - Can be run manually to verify

3. Enhanced error messages:
   - Added checks in `renderer.ts` and `headlessFetcher.ts`
   - Clear error messages if Playwright not installed

**Next Steps:**
- [ ] Monitor Render build logs to confirm Playwright installs
- [ ] Run `npm run verify:playwright` after deployment to verify
- [ ] Test discovery after deployment

### Phase 2: Verification & Testing

**After Playwright is Installed:**
1. **Test Discovery:**
   - Start discovery run
   - Verify items are being saved (should see `saved: > 0` in logs)
   - Check that `extractor_empty` errors are gone
   - Verify content extraction is working

2. **Monitor Metrics:**
   - Check zero-save SLO - should only pause after 2+ minutes
   - Verify reseed circuit breaker doesn't stop discovery
   - Check that items are appearing in UI

3. **Debug Page:**
   - Visit `/patch/chicago-bulls/debug-saved`
   - Verify hero images are showing
   - Check quality scores and content fields

### Phase 3: Additional Improvements (If Needed)

**If Playwright Still Doesn't Install:**
1. Check Render build logs for specific error
2. Consider adding Playwright installation to startup script
3. Add environment variable to disable Playwright (fallback mode)

**If Items Still Not Saving:**
1. Check content quality validation thresholds
2. Review entity extraction requirements
3. Check relevance scoring thresholds

## Environment Variables

### Optional Configuration:
- `DISABLE_ZERO_SAVE_PAUSE=true` - Completely disable zero-save auto-pause
- `ZERO_SAVE_PAUSE_TIME_MS=120000` - Adjust minimum runtime before pause (default: 2 minutes)
- `CRAWLER_MAX_RESEED_ATTEMPTS=10` - Adjust reseed circuit breaker threshold

## Testing Checklist

After deployment:
- [ ] Playwright installs during build (check Render logs)
- [ ] `npm run verify:playwright` passes
- [ ] Discovery starts without Playwright errors
- [ ] Items are being saved (check logs for `saved: > 0`)
- [ ] Zero-save pause only occurs after 2+ minutes
- [ ] Reseed circuit breaker doesn't stop discovery
- [ ] Hero images display correctly
- [ ] Saved items appear in UI
- [ ] Debug page shows all data correctly

## Rollback Plan

If issues occur:
1. Set `DISABLE_ZERO_SAVE_PAUSE=true` to prevent premature pauses
2. Check Render build logs for Playwright installation errors
3. Manually install Playwright if needed: `npx playwright install --with-deps chromium`
4. Review discovery logs for specific error patterns

## Success Criteria

✅ Discovery runs for at least 2 minutes before auto-pausing
✅ Items are being saved (saved count > 0)
✅ Playwright is installed and working
✅ Hero images display correctly
✅ Saved items appear in UI
✅ No premature stops due to reseed circuit breaker

