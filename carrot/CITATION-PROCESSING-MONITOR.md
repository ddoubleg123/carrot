# Citation Processing Monitor

## 🚀 Processing Status

**Script Running:** `process-all-citations-complete.ts`

### Current Progress:
- **Total citations:** 8,839
- **Processed:** ~101
- **Saved:** 19
- **Denied:** 82
- **Remaining:** ~8,738

### Processing Rate:
- ~0.6 citations/second
- ~36 citations/minute
- ~2,160 citations/hour

### Estimated Time:
- **Remaining citations:** ~8,738
- **Estimated time:** ~4 hours

## ✅ What Happens for Each Saved Citation

1. **Saved to DiscoveredContent** ✅
2. **Enqueued for Agent Feeding** ✅
   - Added to `AgentMemoryFeedQueue`
   - Feed worker processes and feeds to agent
3. **Hero Image Generation Triggered** ✅
   - `enrichContentId` called
   - Hero image pipeline generates image

## 📊 Monitor Progress

### Check Current Status:
```bash
ts-node scripts/check-denied-count.ts
```

### Check Saved Citations:
```sql
SELECT COUNT(*) FROM discovered_content 
WHERE patch_id = 'cmip4pwb40001rt1t7a13p27g'
AND metadata->>'source' = 'wikipedia-citation'
```

### Check Agent Feed Queue:
```bash
# When API is available
GET /api/patches/israel/agent/health
```

## ⚠️ Notes

- Process runs continuously until all citations are processed
- Can be stopped with Ctrl+C and resumed (citations maintain state)
- Progress logged every 10 citations
- DeepSeek API is configured in Render
- Citations will get real AI scores (not default 50)

## 🎯 Expected Results

- **Save rate:** 15-25% (or higher with proper API scoring)
- **Total saved:** ~1,300-2,200 citations
- **All saved citations:** 
  - Have hero images
  - Fed to agent
  - Agent learns from all content

