# Self-Audit and Auto-Fix System

## Overview

The system now includes automatic self-auditing and self-correction mechanisms that continuously monitor and fix common issues without manual intervention.

## Components

### 1. Self-Audit Script (`scripts/self-audit-and-fix.ts`)

Automatically detects and fixes:
- **Untitled DiscoveredContent items**: Finds citations and extracts titles from URLs
- **AgentMemory entries missing discovery fields**: Links memories to DiscoveredContent
- **Stuck feed queue items**: Resets items stuck in PROCESSING for > 1 hour

### 2. API Endpoints

#### `/api/system/self-audit` (POST)
- Manually trigger self-audit
- Query param: `?patch=israel` to audit specific patch
- Returns: Results with counts of fixed items

#### `/api/system/health-check` (GET)
- Comprehensive health check
- Returns: System status, issue counts, health indicators
- Status codes: 200 (healthy), 200 (degraded), 503 (unhealthy)

#### `/api/cron/self-audit` (GET)
- Cron endpoint for scheduled audits
- Optional: `CRON_SECRET` env var for authentication
- Designed for external cron services (e.g., Render cron jobs)

### 3. Enhanced Auto-Feed Worker

The `auto-feed-worker.ts` now includes:
- **Automatic self-audit**: Runs every hour (configurable via `SELF_AUDIT_INTERVAL`)
- **Stuck item detection**: Automatically resets stuck queue items
- **Health monitoring**: Continuous verification of system health

## Configuration

### Environment Variables

```bash
# Self-audit interval (default: 1 hour)
SELF_AUDIT_INTERVAL=3600000

# Cron authentication (optional)
CRON_SECRET=your-secret-key

# Feed worker settings
AGENT_FEED_INTERVAL=10000
AGENT_FEED_BATCH_SIZE=20
AGENT_FEED_VERIFY_INTERVAL=60000
```

## Usage

### Manual Self-Audit

```bash
# Audit all patches
npx tsx scripts/self-audit-and-fix.ts

# Audit specific patch
npx tsx scripts/self-audit-and-fix.ts --patch=israel
```

### API Calls

```bash
# Run self-audit via API
curl -X POST https://your-app.onrender.com/api/system/self-audit

# Check system health
curl https://your-app.onrender.com/api/system/health-check

# Cron endpoint (with auth)
curl -H "Authorization: Bearer your-secret" https://your-app.onrender.com/api/cron/self-audit
```

### Scheduled Cron Job (Render)

1. Go to Render Dashboard → Cron Jobs
2. Create new cron job:
   - **Schedule**: `0 * * * *` (every hour)
   - **Command**: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/self-audit`
   - **Environment**: Set `CRON_SECRET` variable

## What Gets Fixed Automatically

### 1. Untitled Items
- Searches for matching Wikipedia citations
- Extracts titles from URLs if citation not found
- Updates DiscoveredContent with proper titles

### 2. AgentMemory Links
- Finds AgentMemory entries missing `patchId` or `discoveredContentId`
- Matches by sourceUrl to DiscoveredContent
- Updates with proper links

### 3. Stuck Queue Items
- Detects items in PROCESSING status for > 1 hour
- Resets to PENDING status
- Increments attempt counter

## Monitoring

### Health Check Response

```json
{
  "timestamp": "2024-12-19T...",
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "untitledItems": { "count": 0, "status": "healthy" },
    "agentMemory": { "missingFields": 0, "status": "healthy" },
    "feedQueue": { "pending": 0, "processing": 0, "stuck": 0, "status": "healthy" }
  },
  "issues": []
}
```

### Status Levels

- **healthy**: All checks pass, no issues
- **degraded**: Some issues detected but system functional
- **unhealthy**: Critical issues (e.g., database connection failed)

## Integration with Auto-Feed Worker

The auto-feed worker automatically:
1. Processes feed queue every 10 seconds
2. Verifies system health every minute
3. Runs self-audit every hour
4. Resets stuck items automatically

## Benefits

✅ **Zero Manual Intervention**: System fixes itself automatically
✅ **Continuous Monitoring**: Issues detected and fixed in real-time
✅ **Self-Healing**: Stuck items automatically reset
✅ **Health Visibility**: API endpoints for monitoring
✅ **Scalable**: Works across all patches automatically

## Next Steps

1. **Set up Render cron job** for hourly self-audit
2. **Monitor health endpoint** for alerts
3. **Review logs** periodically to ensure fixes are working
4. **Adjust intervals** based on system load

