# Next Steps - Discovery Testing & Monitoring

## 🎯 Immediate Next Steps

### 1. Test Discovery with New Fixes ⚠️ CRITICAL
**Action**: Run discovery on a patch (e.g., "Israel") and monitor the logs

**What to Look For**:
- ✅ Items being saved (should NOT be zero save rate anymore)
- ✅ Anna's Archive searches happening: `[MultiSourceOrchestrator] Searching Anna's Archive...`
- ✅ Anna's Archive seeds being added: `[Seed Planner] ✅ Enqueued X Anna's Archive seeds to frontier`
- ✅ Anna's Archive URLs being processed: `[EngineV21] Detected Anna's Archive URL, using book extraction...`
- ✅ Duplicate detection logging: `[Redis Duplicate] Found near-duplicate: Hamming distance X`
- ✅ Detailed rejection reasons in logs

**How to Monitor**:
1. Start discovery via frontend or API
2. Watch server logs in real-time
3. Check for the log messages above
4. Monitor save count - should see items being saved

### 2. Analyze Hamming Distances
**Action**: Review the duplicate detection logs to tune threshold

**What to Check**:
- Look for `[Redis Duplicate] Found near-duplicate: Hamming distance X` messages
- Look for `[Redis Duplicate] Closest match: Hamming distance X` messages
- If many items are being rejected with Hamming distances close to 7, consider adjusting threshold

**Threshold Adjustment** (if needed):
```bash
# Set environment variable to adjust duplicate threshold
DISCOVERY_V2_DUPLICATE_HASH_THRESHOLD=5  # More lenient (fewer duplicates rejected)
DISCOVERY_V2_DUPLICATE_HASH_THRESHOLD=10 # More strict (more duplicates rejected)
```

### 3. Verify Anna's Archive Integration
**Action**: Confirm Anna's Archive sources are being found and processed

**Checkpoints**:
- ✅ MultiSourceOrchestrator finds Anna's Archive sources
- ✅ Seeds are added to frontier
- ✅ engineV21 detects and extracts Anna's Archive URLs
- ✅ Content is saved with book extraction (not web scraping)

**Success Indicators**:
- Logs show Anna's Archive searches returning results
- Frontier shows Anna's Archive URLs being processed
- Saved content includes book content (longer, structured text)

### 4. Monitor Save Rate
**Action**: Track how many items are being saved vs rejected

**Metrics to Watch**:
- Total items processed
- Items saved
- Items rejected (and reasons: duplicate, entity_missing, relevance, quality)
- Save rate (saved / processed)

**If Still Zero Save Rate**:
1. Check logs for rejection reasons
2. Review Hamming distances (may need threshold adjustment)
3. Check entity mentions (may need relevance tuning)
4. Review relevance scores (may need threshold adjustment)

### 5. Verify Hero Images
**Action**: Once items are being saved, check hero image generation

**What to Check**:
- Hero images being generated for new items
- Hero images appear in frontend
- Self-audit script can fix missing heroes

### 6. Run Full Backfill (When Ready)
**Action**: Run comprehensive backfill on all existing content

```bash
cd carrot
# Run on all content (no limit)
npx tsx scripts/self-audit-all.ts israel

# Or run on specific patch
npx tsx scripts/self-audit-all.ts [patchHandle]
```

**Note**: This requires API to be running (for hero generation and grammar fixes)

## 📊 Monitoring Checklist

When running discovery, verify:

- [ ] Discovery starts successfully
- [ ] Anna's Archive searches execute (`[MultiSourceOrchestrator]` logs)
- [ ] Anna's Archive seeds added to frontier (`[Seed Planner]` logs)
- [ ] Anna's Archive URLs processed (`[EngineV21]` logs)
- [ ] Items being saved (check metrics/save count)
- [ ] Duplicate detection logging works (`[Redis Duplicate]` logs)
- [ ] Rejection reasons logged (entity_missing, duplicate, relevance, etc.)
- [ ] Hero images generated for saved items
- [ ] Frontend shows new items

## 🔧 Troubleshooting

### If Zero Save Rate Persists:

1. **Check Duplicate Detection**:
   - Look at Hamming distances in logs
   - If many items rejected with Hamming distance 5-7, threshold may be too strict
   - Try lowering threshold: `DISCOVERY_V2_DUPLICATE_HASH_THRESHOLD=5`

2. **Check Entity Mentions**:
   - Look for `entity_missing` rejections
   - Review entity check logic if too many false negatives

3. **Check Relevance Scores**:
   - Look for `low_relevance` rejections
   - Review relevance engine if scores too low

4. **Check Quality Scores**:
   - Look for `low_quality` rejections
   - Review quality thresholds if too strict

### If Anna's Archive Not Working:

1. **Check Search Execution**:
   - Look for `[MultiSourceOrchestrator] Searching Anna's Archive...` logs
   - If missing, check if MultiSourceOrchestrator is being called

2. **Check Seed Addition**:
   - Look for `[Seed Planner] ✅ Added X Anna's Archive books` logs
   - If 0, check if searches are returning results

3. **Check URL Processing**:
   - Look for `[EngineV21] Detected Anna's Archive URL` logs
   - If missing, check URL detection logic

## 🎉 Success Criteria

Discovery is working correctly when:

1. ✅ Items are being saved (save rate > 0%)
2. ✅ Anna's Archive sources are found and processed
3. ✅ Logging shows detailed rejection reasons
4. ✅ Hero images generated for saved items
5. ✅ No zero save rate issue

## 📝 Notes

- All fixes are committed and ready
- Backfill scripts verified (work when API available)
- Logging enhanced for better debugging
- Anna's Archive integration complete

**Ready to test!** 🚀

