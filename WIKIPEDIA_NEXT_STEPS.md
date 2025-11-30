# Wikipedia Monitoring - Next Steps Guide

## ✅ What's Been Completed

1. **Database Schema** - Tables defined in Prisma schema
2. **Services Created** - WikipediaMonitoring, WikipediaCitation, WikipediaProcessor
3. **API Endpoint** - `/api/patches/[handle]/wikipedia-status`
4. **Metrics Service** - Status tracking and progress monitoring
5. **Structured Logging** - Enhanced logging for visibility
6. **Integration** - Hooked into patch creation and discovery engine

## 🚀 Next Steps

### Step 1: Create Database Tables

**Option A: Manual SQL (Recommended)**
```bash
# Run the SQL migration directly on your database
psql $DATABASE_URL -f carrot/prisma/migrations/manual_wikipedia_tables.sql

# OR use your database admin tool (pgAdmin, DBeaver, etc.)
# Execute: carrot/prisma/migrations/manual_wikipedia_tables.sql
```

**Option B: Prisma DB Push**
```bash
cd carrot
npx prisma db push --accept-data-loss
# ⚠️ WARNING: May affect existing tables
```

**Option C: Prisma Migrate**
```bash
cd carrot
npx prisma migrate dev --name add_wikipedia_monitoring
# May fail if shadow database has issues
```

### Step 2: Verify Tables Exist

```bash
cd carrot
npx tsx scripts/verify-wikipedia-tables.ts
```

Expected output:
```
✅ Tables exist and are accessible!
   - WikipediaMonitoring: 0 records
   - WikipediaCitation: 0 records
✅ Write test successful!
✅ All checks passed! Wikipedia monitoring is ready.
```

### Step 3: Test the API Endpoint

```bash
# Test with a specific patch
curl http://localhost:3000/api/patches/chicago-bulls/wikipedia-status

# With top citations
curl "http://localhost:3000/api/patches/chicago-bulls/wikipedia-status?includeTopCitations=true"
```

Expected response:
```json
{
  "success": true,
  "patch": { "id": "...", "handle": "chicago-bulls", "title": "Chicago Bulls" },
  "status": {
    "totalPages": 0,
    "scannedPages": 0,
    "totalCitations": 0,
    ...
  },
  "timestamp": "2025-01-15T..."
}
```

### Step 4: Initialize Wikipedia Monitoring

**For Existing Patches:**
```bash
cd carrot
npx tsx scripts/trigger-wikipedia-init.ts chicago-bulls
```

**For New Patches:**
- Create a new patch via the UI
- Wikipedia monitoring will automatically initialize
- Check logs for: `[WikipediaMonitoring] Initializing for patch...`

### Step 5: Test API Functions

```bash
cd carrot
npx tsx scripts/test-wikipedia-api.ts chicago-bulls
```

This will test:
- Status retrieval
- Progress calculation
- Top priority citations

### Step 6: Run Discovery

1. Go to a patch page
2. Click "Start Discovery"
3. Monitor logs for:
   - `[WikipediaMonitoring] Initializing...`
   - `[WikipediaProcessor] Processing Wikipedia page...`
   - `wikipedia_page_complete` events

### Step 7: Monitor Progress

**Via API:**
```bash
# Check status
GET /api/patches/[handle]/wikipedia-status

# Response includes:
# - Total pages found vs scanned
# - Citations extracted vs processed
# - Saved vs denied citations
# - Average priority scores
# - Processing progress percentages
```

**Via Logs:**
Look for structured log events:
- `wikipedia_monitoring_init`
- `wikipedia_search_complete`
- `wikipedia_monitoring_stored`
- `wikipedia_page_processing`
- `wikipedia_page_complete`

**Via Database:**
```sql
-- Check pages being monitored
SELECT * FROM wikipedia_monitoring WHERE patch_id = '...';

-- Check citations
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN scan_status = 'scanned' THEN 1 ELSE 0 END) as processed,
  SUM(CASE WHEN relevance_decision = 'saved' THEN 1 ELSE 0 END) as saved
FROM wikipedia_citations
WHERE monitoring_id IN (
  SELECT id FROM wikipedia_monitoring WHERE patch_id = '...'
);
```

## 🔍 Troubleshooting

### Tables Don't Exist
**Error:** `The table 'public.wikipedia_monitoring' does not exist`

**Fix:** Run Step 1 (Create Database Tables)

### No Pages Found
**Symptom:** `pagesFound: 0` in initialization

**Possible Causes:**
- Search terms don't match Wikipedia pages
- Wikipedia API rate limiting
- Network issues

**Fix:** 
- Check search terms are valid
- Wait and retry
- Check Wikipedia API status

### Initialization Not Running
**Symptom:** No logs from `initializeWikipediaMonitoring`

**Possible Causes:**
- Patch created before integration
- Background task failing silently

**Fix:**
- Manually trigger: `npx tsx scripts/trigger-wikipedia-init.ts [handle]`
- Check error logs in patch creation API

### Incremental Processing Failing
**Error:** `Error in Wikipedia incremental processing: table does not exist`

**Fix:** Run Step 1 (Create Database Tables)

## 📊 Monitoring Checklist

- [ ] Tables created and verified
- [ ] API endpoint accessible
- [ ] Initialization runs on patch creation
- [ ] Wikipedia pages found and stored
- [ ] Citations extracted with priority scores
- [ ] Incremental processing working
- [ ] Citations being saved to content/memory
- [ ] Progress tracking accurate

## 🎯 Success Criteria

1. **Tables Created:** `verify-wikipedia-tables.ts` passes
2. **API Working:** Status endpoint returns data
3. **Initialization:** New patches trigger Wikipedia search
4. **Processing:** Pages and citations processed incrementally
5. **Saving:** Relevant citations saved to content/memory
6. **Progress:** Status shows accurate progress percentages

## 📝 Notes

- Wikipedia monitoring runs in background (non-blocking)
- Incremental processing happens every 30 seconds during discovery
- Citations are prioritized using AI (DeepSeek)
- Only top 25 prioritized citations are processed per page
- Content is saved to both DiscoveredContent and AgentMemory

