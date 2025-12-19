# Self-Audit and Auto-Fix System - Complete ✅

## What Was Built

A comprehensive self-auditing and self-correcting system that automatically detects and fixes common issues without manual intervention.

## Components Created

### 1. Core Self-Audit Script
**File**: `scripts/self-audit-and-fix.ts`

Automatically fixes:
- ✅ Untitled DiscoveredContent items (finds citations, extracts from URLs)
- ✅ AgentMemory entries missing discovery fields (links to DiscoveredContent)
- ✅ Stuck feed queue items (resets items stuck > 1 hour)

### 2. API Endpoints

#### `/api/system/self-audit` (POST)
- Manually trigger self-audit
- Query param: `?patch=israel` for specific patch
- Returns detailed results

#### `/api/system/health-check` (GET)
- Comprehensive health monitoring
- Returns system status, issue counts
- Status: healthy, degraded, or unhealthy

#### `/api/cron/self-audit` (GET)
- Cron endpoint for scheduled audits
- Optional `CRON_SECRET` authentication
- Designed for Render cron jobs

### 3. Enhanced Auto-Feed Worker
**File**: `scripts/auto-feed-worker.ts`

Now includes:
- ✅ Automatic self-audit every hour
- ✅ Stuck item detection and reset
- ✅ Continuous health monitoring

## How It Works

### Automatic Self-Audit Flow

1. **Every Hour** (configurable):
   - Scans all patches for issues
   - Fixes untitled items
   - Links AgentMemory entries
   - Resets stuck queue items

2. **Continuous Monitoring**:
   - Auto-feed worker processes queue every 10 seconds
   - Verifies system health every minute
   - Detects and fixes stuck items automatically

3. **Health Checks**:
   - Database connectivity
   - Untitled item count
   - AgentMemory missing fields
   - Feed queue status

## Usage

### Manual Trigger

```bash
# Audit all patches
npx tsx scripts/self-audit-and-fix.ts

# Audit specific patch
npx tsx scripts/self-audit-and-fix.ts --patch=israel
```

### API Calls

```bash
# Run self-audit
curl -X POST https://your-app.onrender.com/api/system/self-audit

# Check health
curl https://your-app.onrender.com/api/system/health-check

# Cron endpoint
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.onrender.com/api/cron/self-audit
```

### Render Cron Job Setup

1. Go to Render Dashboard → Cron Jobs
2. Create new cron job:
   - **Schedule**: `0 * * * *` (every hour)
   - **Command**: 
     ```bash
     curl -H "Authorization: Bearer $CRON_SECRET" \
       https://your-app.onrender.com/api/cron/self-audit
     ```
   - **Environment**: Set `CRON_SECRET` variable

## Configuration

### Environment Variables

```bash
# Self-audit interval (default: 1 hour = 3600000ms)
SELF_AUDIT_INTERVAL=3600000

# Cron authentication (optional but recommended)
CRON_SECRET=your-secret-key-here

# Feed worker settings
AGENT_FEED_INTERVAL=10000        # 10 seconds
AGENT_FEED_BATCH_SIZE=20
AGENT_FEED_VERIFY_INTERVAL=60000  # 1 minute
```

## What Gets Fixed

### 1. Untitled Items
- Searches for matching Wikipedia citations
- Extracts titles from URLs if citation not found
- Updates DiscoveredContent with proper titles

### 2. AgentMemory Links
- Finds entries missing `patchId` or `discoveredContentId`
- Matches by sourceUrl to DiscoveredContent
- Updates with proper links

### 3. Stuck Queue Items
- Detects items in PROCESSING for > 1 hour
- Resets to PENDING
- Increments attempt counter

## Monitoring

### Health Check Response Example

```json
{
  "timestamp": "2024-12-19T...",
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "untitledItems": { "count": 0, "status": "healthy" },
    "agentMemory": { "missingFields": 0, "status": "healthy" },
    "feedQueue": {
      "pending": 0,
      "processing": 0,
      "stuck": 0,
      "status": "healthy"
    }
  },
  "issues": []
}
```

### Status Levels

- **healthy**: All checks pass, no issues
- **degraded**: Some issues detected (e.g., >10 untitled items)
- **unhealthy**: Critical issues (e.g., database connection failed)

## Benefits

✅ **Zero Manual Intervention**: System fixes itself automatically
✅ **Continuous Monitoring**: Issues detected in real-time
✅ **Self-Healing**: Stuck items automatically reset
✅ **Health Visibility**: API endpoints for monitoring
✅ **Scalable**: Works across all patches automatically
✅ **Production Ready**: Includes error handling and logging

## Testing

The system has been tested and verified:
- ✅ Self-audit script runs successfully
- ✅ Fixes untitled items correctly
- ✅ Links AgentMemory entries properly
- ✅ Resets stuck queue items
- ✅ Health check endpoint works
- ✅ API endpoints respond correctly

## Next Steps

1. **Deploy to Render**: Push all changes
2. **Set up cron job**: Configure hourly self-audit
3. **Monitor health**: Set up alerts on health-check endpoint
4. **Review logs**: Periodically check self-audit results

## Files Created/Modified

### New Files
- `scripts/self-audit-and-fix.ts`
- `src/app/api/system/self-audit/route.ts`
- `src/app/api/system/health-check/route.ts`
- `src/app/api/cron/self-audit/route.ts`
- `SELF-AUDIT-SYSTEM.md`
- `SELF-AUDIT-COMPLETE.md`

### Modified Files
- `scripts/auto-feed-worker.ts` (added self-audit integration)

## Summary

The system is now fully self-auditing and self-correcting. It will:
- Automatically fix untitled items
- Link AgentMemory entries
- Reset stuck queue items
- Monitor system health
- Report issues via API

All without any manual intervention! 🎉

