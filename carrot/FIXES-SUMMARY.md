# Discovery Fixes Summary

## ✅ Completed Fixes

### 1. Duplicate Detection Improvements (zero-save-2)
- **Fixed**: Clarified the two duplicate checks (Redis vs in-memory)
- **Added**: Better logging to distinguish `near_duplicate_redis` vs `near_duplicate_in_memory`
- **Fixed**: Moved `markContentHash` to after successful save (was being called too early)

### 2. Enhanced Logging (zero-save-4, zero-save-5)
- **Added**: Detailed logging for `entity_missing` rejections (includes title and text length)
- **Added**: Logging for duplicate detection (source, threshold, Hamming distance)
- **Added**: Structured logging throughout the rejection pipeline
- **Added**: Hamming distance tracking in Redis duplicate check to help tune threshold

### 3. Anna's Archive Integration (annas-archive-1 through annas-archive-5)
- **Added**: `isAnnasArchiveUrl()` detection in engineV21
- **Added**: Anna's Archive book extraction in `fetchAndExtractContent()` (uses `extractBookContent` script)
- **Added**: Comprehensive logging in `MultiSourceOrchestrator` to track searches
- **Added**: Logging in `seedFrontierFromPlan` to track Anna's Archive seeds
- **Added**: Logging when Anna's Archive seeds are enqueued to frontier

### 4. Entity Check Logging (zero-save-3)
- **Verified**: PDF "Untitled" title handling is already in place
- **Added**: Enhanced logging to track entity check failures with context

## 🔍 Investigation Findings

### Duplicate Detection Analysis (zero-save-5)
- **Confirmed**: Redis `isNearDuplicate` checks against ALL previous content (last 1000 entries), not just this run
- **Threshold**: Default is 7 (Hamming distance out of 64 bits for SimHash)
- **Added**: Logging to track actual Hamming distances to help tune threshold
- **Note**: Threshold can be adjusted via `DISCOVERY_V2_DUPLICATE_HASH_THRESHOLD` environment variable

## 📋 Next Steps for Testing

### 1. Monitor Discovery with New Logging
When running discovery, look for these log messages:
- `[Redis Duplicate] Found near-duplicate: Hamming distance X (threshold: 7)`
- `[Redis Duplicate] Closest match: Hamming distance X (threshold: 7, below threshold+3)`
- `[MultiSourceOrchestrator] Searching Anna's Archive with X queries: [...]`
- `[Seed Planner] ✅ Enqueued X Anna's Archive seeds to frontier`
- `[EngineV21] Detected Anna's Archive URL, using book extraction: ...`

### 2. Review Hamming Distances
After running discovery, check logs to see:
- What Hamming distances are being found (are they close to 7, or much lower?)
- If threshold of 7 is too aggressive, consider adjusting via environment variable

### 3. Run Backfill Scripts
Once database is accessible:
```bash
cd carrot
npx tsx scripts/self-audit-all.ts israel --limit=50
```

This will:
- Fix missing/placeholder hero images
- Fix grammar and content quality issues

## 🎯 Remaining Items to Verify (After Testing)

1. **Zero Save Rate**: Monitor logs to see actual rejection reasons and Hamming distances
2. **Anna's Archive**: Verify seeds are being found and processed correctly
3. **Hero Images**: Verify generation works once items are being saved
4. **Backfill**: Run self-audit scripts when database is accessible

## 📝 Files Modified

- `carrot/src/lib/discovery/engineV21.ts` - Added Anna's Archive detection, enhanced logging
- `carrot/src/lib/discovery/planner.ts` - Added Anna's Archive seed tracking
- `carrot/src/lib/discovery/multiSourceOrchestrator.ts` - Added search logging
- `carrot/src/lib/redis/discovery.ts` - Added Hamming distance logging

