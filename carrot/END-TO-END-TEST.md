# End-to-End Test Guide

## Test Flow: Citation → DiscoveredContent → AgentMemory → Frontend

### Prerequisites

1. Ensure system is deployed and running
2. Have access to database
3. Have a test patch (e.g., "israel")

### Test Steps

#### 1. Check Initial State

```bash
# Check system health
curl https://your-app.onrender.com/api/system/health-check

# Check current status
npx tsx scripts/check-live-system-status.ts --patch=israel
```

Expected:
- Health status: "healthy"
- Some DiscoveredContent items exist
- Feed queue is processing

#### 2. Test Citation Processing

```bash
# Process a new citation (if available)
# Or reprocess an existing one
npx tsx scripts/process-all-citations.ts --patch=israel --limit=1
```

Verify:
- Citation gets saved
- DiscoveredContent is created
- Title is extracted correctly (not "Untitled")

#### 3. Test Title Extraction

```bash
# Check for untitled items
npx tsx scripts/check-hero-titles.ts --patch=israel

# Run self-audit to fix any issues
npx tsx scripts/self-audit-and-fix.ts --patch=israel
```

Expected:
- No "Untitled" items (or minimal)
- Titles are meaningful

#### 4. Test Agent Feed Queue

```bash
# Check feed queue status
curl https://your-app.onrender.com/api/agent-feed/verify

# Process queue manually
curl -X POST https://your-app.onrender.com/api/agent-feed/process-all
```

Verify:
- Items are enqueued
- Items are processed
- AgentMemory entries are created

#### 5. Test AgentMemory Creation

```bash
# Check agent learning status
npx tsx scripts/check-live-system-status.ts --patch=israel
```

Expected:
- AgentMemory entries exist
- Entries have `discoveredContentId` and `patchId`
- Coverage > 0%

#### 6. Test Frontend Display

1. Navigate to patch page: `https://your-app.onrender.com/patch/israel`
2. Check Overview tab
3. Verify:
   - Heroes are visible
   - Titles are correct (not "Untitled")
   - Images load properly
   - Clicking opens detail page

#### 7. Test Self-Audit

```bash
# Run self-audit manually
curl -X POST https://your-app.onrender.com/api/system/self-audit

# Check results
# Should show fixes applied
```

Expected:
- Fixes untitled items
- Links AgentMemory entries
- Resets stuck queue items

#### 8. Test Health Monitoring

```bash
# Check health endpoint
curl https://your-app.onrender.com/api/system/health-check
```

Expected:
- Status: "healthy" or "degraded"
- All checks pass or show minimal issues
- No critical errors

### Success Criteria

✅ **Citation Processing**
- Citations are extracted and saved
- Titles are extracted correctly
- Content is saved to DiscoveredContent

✅ **Agent Learning**
- DiscoveredContent is enqueued
- AgentMemory entries are created
- Entries have proper discovery fields

✅ **Frontend Display**
- Heroes are visible
- Titles are correct
- Images load
- Detail pages work

✅ **Self-Audit**
- Automatically fixes issues
- Runs on schedule
- Reports results

### Troubleshooting

#### Citations Not Saving

1. Check DeepSeek API key
2. Verify content extraction
3. Check relevance scores
4. Review logs

#### Titles Still "Untitled"

1. Run backfill script
2. Check title extraction logic
3. Verify citations have titles
4. Run self-audit

#### AgentMemory Not Created

1. Check feed queue status
2. Verify feed worker is running
3. Check for errors in logs
4. Run manual feed processing

#### Frontend Not Showing Heroes

1. Check API response
2. Verify titles in database
3. Check browser console
4. Verify images are generated

### Automated Test Script

```bash
#!/bin/bash
# test-end-to-end.sh

PATCH="israel"
BASE_URL="https://your-app.onrender.com"

echo "🧪 Running end-to-end tests..."

# 1. Health check
echo "1. Health check..."
curl -s "$BASE_URL/api/system/health-check" | jq '.status'

# 2. Self-audit
echo "2. Running self-audit..."
curl -s -X POST "$BASE_URL/api/system/self-audit" | jq '.results'

# 3. Feed queue status
echo "3. Feed queue status..."
curl -s "$BASE_URL/api/agent-feed/verify" | jq '.summary'

# 4. Process queue
echo "4. Processing queue..."
curl -s -X POST "$BASE_URL/api/agent-feed/process-all" | jq

echo "✅ Tests complete!"
```

### Continuous Monitoring

Set up monitoring for:
- Health check endpoint (every 5 minutes)
- Feed queue lag (alert if > 100 pending)
- AgentMemory creation rate
- Frontend hero display

### Performance Benchmarks

Expected performance:
- Citation processing: < 30 seconds per citation
- Title extraction: < 5 seconds
- AgentMemory creation: < 10 seconds per item
- Self-audit: < 2 minutes for all patches
- Health check: < 1 second

### Next Steps After Testing

1. ✅ Verify all tests pass
2. ✅ Set up monitoring
3. ✅ Configure alerts
4. ✅ Document any issues
5. ✅ Update deployment guide

