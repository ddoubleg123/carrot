# Wikipedia Monitoring System - Status Report

## Analysis of Render Logs (2222.txt)

### ✅ What's Working

1. **Wikipedia Seed Detection**
   - Wikipedia seeds are being detected and allowed by the planner
   - Log: `[Seed Planner] Wikipedia seed detected: https://en.wikipedia.org/wiki/Chicago_Bulls`
   - Log: `[Seed Planner] Allowing Wikipedia seed for deep link extraction`

2. **Wikipedia Page Processing**
   - Wikipedia pages are being fetched successfully
   - Log: `[EngineV21] Processing Wikipedia page for deep link extraction: https://en.wikipedia.org/wiki/Chicago_Bulls`
   - Successfully extracted 59,907 characters from Chicago Bulls page

3. **Citation Extraction**
   - Citations are being extracted from Wikipedia pages
   - Log: `wiki_outlinks_enqueued` with `count: 23, limit: 25`
   - 23 outlinks were successfully enqueued from the Chicago Bulls page

4. **Discovery Engine Running**
   - Engine is processing candidates
   - Multiple URLs being fetched and processed

### ❌ What's NOT Working

1. **Database Tables Missing** (CRITICAL)
   ```
   Error: The table `public.wikipedia_monitoring` does not exist in the current database.
   ```
   - **Impact**: Incremental processing fails every 30 seconds
   - **Cause**: Prisma migrations haven't been run
   - **Fix Required**: Run `npx prisma migrate dev` or `npx prisma db push`

2. **No Initialization Logs**
   - No logs from `initializeWikipediaMonitoring` function
   - **Possible Causes**:
     - Patch was created before integration was added
     - Initialization is failing silently
     - Background task not executing

3. **Zero Items Saved**
   - All discovery runs show `"saved":0`
   - No content is being saved to the database
   - This is a separate issue from Wikipedia monitoring

4. **Incremental Processing Failing**
   - Every attempt to process Wikipedia incrementally fails
   - Error occurs every ~30 seconds during discovery loop
   - Prevents resume capability from working

## Monitoring Tools Added

### 1. Structured Logging
Added structured logging to track:
- `wikipedia_monitoring_init` - When initialization starts
- `wikipedia_search_complete` - Search results summary
- `wikipedia_monitoring_stored` - Storage results
- `wikipedia_page_processing` - Page processing start
- `wikipedia_page_complete` - Page processing completion
- `wikipedia_monitoring_init_error` - Initialization errors

### 2. Metrics Service (`wikipediaMetrics.ts`)
New service provides:
- **`getWikipediaMonitoringStatus()`** - Comprehensive status:
  - Total pages found vs scanned
  - Total citations vs processed
  - Saved vs denied citations
  - Average priority scores
  - Last processed timestamp

- **`getWikipediaProcessingProgress()`** - Progress percentages:
  - Pages progress (0-100%)
  - Citations progress (0-100%)
  - Overall progress (weighted average)

- **`getTopPriorityCitations()`** - Top citations awaiting processing:
  - Sorted by AI priority score
  - Shows status and source numbers

### 3. Enhanced Error Logging
- Added error logging in patch creation API
- Structured error events for debugging
- Non-blocking error handling

## Next Steps

### Immediate Actions Required

1. **Run Database Migrations**
   
   **Option A: Use Prisma (if shadow database works)**
   ```bash
   cd carrot
   npx prisma migrate dev --name add_wikipedia_monitoring
   ```
   
   **Option B: Manual SQL Migration (recommended if Prisma fails)**
   ```bash
   # Run the SQL file directly on your database
   psql $DATABASE_URL -f carrot/prisma/migrations/manual_wikipedia_tables.sql
   # OR use your database admin tool to run:
   # carrot/prisma/migrations/manual_wikipedia_tables.sql
   ```
   
   **Option C: Prisma DB Push (with data loss warning)**
   ```bash
   cd carrot
   npx prisma db push --accept-data-loss
   # ⚠️ WARNING: This may drop columns from existing tables
   ```

2. **Verify Initialization**
   - Create a new patch to test initialization
   - Check logs for `[WikipediaMonitoring] Initializing` messages
   - Verify structured logs appear

3. **Test Incremental Processing**
   - After migrations, run discovery again
   - Check that incremental processing no longer errors
   - Verify pages and citations are being processed

### Monitoring & Verification

1. **Check Status via API**
   ```bash
   # Get Wikipedia monitoring status
   GET /api/patches/[handle]/wikipedia-status
   
   # With top priority citations
   GET /api/patches/[handle]/wikipedia-status?includeTopCitations=true
   ```
   
   **Response:**
   ```json
   {
     "success": true,
     "patch": { "id": "...", "handle": "...", "title": "..." },
     "status": {
       "totalPages": 5,
       "scannedPages": 3,
       "pagesWithCitations": 2,
       "totalCitations": 45,
       "processedCitations": 12,
       "savedCitations": 8,
       "deniedCitations": 4,
       "pendingCitations": 33,
       "lastProcessedAt": "2025-01-15T...",
       "averagePriorityScore": 72.5,
       "progress": {
         "pagesProgress": 60,
         "citationsProgress": 27,
         "overallProgress": 43
       }
     },
     "topCitations": [...],
     "timestamp": "2025-01-15T..."
   }
   ```
   
   **Programmatic Usage:**
   ```typescript
   import { getWikipediaMonitoringStatus } from '@/lib/discovery/wikipediaMetrics'
   const status = await getWikipediaMonitoringStatus(patchId)
   ```

2. **Monitor Logs For**:
   - `wikipedia_monitoring_init` events
   - `wikipedia_search_complete` with pagesFound > 0
   - `wikipedia_page_processing` events
   - `wikipedia_page_complete` with citationsFound > 0

3. **Database Queries**:
   ```sql
   -- Check if pages are being stored
   SELECT COUNT(*) FROM wikipedia_monitoring WHERE patch_id = '...';
   
   -- Check citation extraction
   SELECT COUNT(*) FROM wikipedia_citations WHERE monitoring_id IN (...);
   
   -- Check processing progress
   SELECT 
     COUNT(*) as total,
     SUM(CASE WHEN scan_status = 'scanned' THEN 1 ELSE 0 END) as processed,
     SUM(CASE WHEN relevance_decision = 'saved' THEN 1 ELSE 0 END) as saved
   FROM wikipedia_citations;
   ```

## Priority System Verification

The AI prioritization system should:
1. Extract citations with context (title, text)
2. Score citations 0-100 based on relevance
3. Sort by score (highest first)
4. Process top 25 prioritized citations

**To Verify**:
- Check `ai_priority_score` column in `wikipedia_citations` table
- Verify scores are between 0-100
- Check that citations are ordered by score in processing queue

## Summary

**Working**: Wikipedia detection, page fetching, citation extraction
**Not Working**: Database tables missing, initialization not visible, incremental processing failing
**Added**: Structured logging, metrics service, error tracking

**Critical Fix**: Run database migrations immediately to enable incremental processing.

