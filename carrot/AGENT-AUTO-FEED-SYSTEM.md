# Agent Auto-Feed System

## Overview

This system automatically feeds all DiscoveredContent to patch agents and includes verification mechanisms to ensure everything stays up to date.

## Components

### 1. Automatic Processing

**API Endpoints:**
- `POST /api/agent-feed/process-all` - Process all pending queues (for all patches)
- `POST /api/patches/[handle]/agent/process` - Process queue for specific patch
- `GET /api/patches/[handle]/agent/process` - Get processing status

**Worker Script:**
- `scripts/auto-feed-worker.ts` - Continuous worker that processes queues automatically
  - Processes queues every 10 seconds (configurable)
  - Verifies system health every 60 seconds
  - Handles stuck items automatically
  - Detects missing content

### 2. Verification System

**API Endpoints:**
- `GET /api/agent-feed/verify` - Comprehensive verification across all patches
- `GET /api/patches/[handle]/agent/health` - Health check for specific patch

**Verification Script:**
- `scripts/verify-agent-feed-system.ts` - Standalone verification tool

**What It Checks:**
- All DiscoveredContent is queued or fed
- Queue items are being processed
- AgentMemory entries are being created
- No stuck items in PROCESSING state
- Coverage percentage

### 3. Auto-Enqueue on Discovery

When new DiscoveredContent is saved:
- Automatically enqueued to `AgentMemoryFeedQueue`
- No manual intervention needed
- Handled by `engineV21.ts` and `wikipediaCitation.ts`

## Usage

### Start Automatic Worker

```bash
# Run continuously
npx tsx scripts/auto-feed-worker.ts

# Or with custom settings
AGENT_FEED_INTERVAL=5000 AGENT_FEED_BATCH_SIZE=50 npx tsx scripts/auto-feed-worker.ts
```

### Verify System

```bash
# Verify all patches
npx tsx scripts/verify-agent-feed-system.ts

# Verify specific patch
npx tsx scripts/verify-agent-feed-system.ts --patch=israel
```

### Manual Processing

```bash
# Process all queues via API
curl -X POST http://localhost:3000/api/agent-feed/process-all

# Process specific patch
curl -X POST http://localhost:3000/api/patches/israel/agent/process

# Get verification status
curl http://localhost:3000/api/agent-feed/verify
```

## Scheduled Jobs (Recommended)

### Option 1: Cron Job

Add to your cron schedule:

```bash
# Process queues every 5 minutes
*/5 * * * * curl -X POST https://your-domain.com/api/agent-feed/process-all

# Verify system every hour
0 * * * * curl https://your-domain.com/api/agent-feed/verify
```

### Option 2: Background Worker

Run the worker script as a background service:

```bash
# Using PM2
pm2 start scripts/auto-feed-worker.ts --name agent-feed-worker

# Using systemd
# Create service file at /etc/systemd/system/agent-feed-worker.service
```

### Option 3: Render Cron Jobs

Add to `render.yaml`:

```yaml
services:
  - type: cron
    name: agent-feed-processor
    schedule: "*/5 * * * *"  # Every 5 minutes
    buildCommand: npm install
    startCommand: curl -X POST https://your-app.onrender.com/api/agent-feed/process-all
```

## Configuration

### Environment Variables

- `AGENT_FEED_INTERVAL` - Processing interval in ms (default: 10000)
- `AGENT_FEED_BATCH_SIZE` - Items per batch (default: 20)
- `AGENT_FEED_VERIFY_INTERVAL` - Verification interval in ms (default: 60000)
- `MIN_TEXT_BYTES_FOR_AGENT` - Minimum text bytes (default: 50)
- `MIN_RELEVANCE_SCORE` - Minimum relevance score (default: 0)

## Monitoring

### Health Check

```bash
# Check specific patch
curl http://localhost:3000/api/patches/israel/agent/health

# Response:
{
  "success": true,
  "counts": {
    "queued": 10,
    "processing": 0,
    "done": 100,
    "failed": 2,
    "total": 112
  },
  "lagSeconds": 30,
  "memoryCount": 95
}
```

### Verification

```bash
curl http://localhost:3000/api/agent-feed/verify?patch=israel

# Response:
{
  "timestamp": "2025-12-18T...",
  "overall": {
    "healthy": true,
    "issues": []
  },
  "patches": [{
    "patch": "israel",
    "healthy": true,
    "stats": {
      "discoveredContent": 51,
      "queued": 0,
      "fed": 51,
      "missing": 0
    }
  }]
}
```

## Troubleshooting

### Items Not Processing

1. Check if worker is running:
   ```bash
   ps aux | grep auto-feed-worker
   ```

2. Check queue status:
   ```bash
   curl http://localhost:3000/api/patches/israel/agent/process
   ```

3. Manually process:
   ```bash
   curl -X POST http://localhost:3000/api/patches/israel/agent/process
   ```

### Stuck Items

The worker automatically detects and resets items stuck in PROCESSING state (>5 minutes).

### Missing Content

If DiscoveredContent is not in queue:
```bash
# Sync to enqueue missing items
curl -X POST http://localhost:3000/api/patches/israel/agent/sync
```

## System Flow

1. **Discovery** → Content saved to `DiscoveredContent`
2. **Auto-Enqueue** → Automatically added to `AgentMemoryFeedQueue`
3. **Processing** → Worker processes queue items
4. **Feeding** → Content fed to agent via `FeedService`
5. **Storage** → `AgentMemory` entry created
6. **Verification** → System checks for discrepancies

## Status

✅ Automatic enqueue on discovery
✅ Automatic processing worker
✅ Verification system
✅ Health checks
✅ Stuck item detection
✅ Missing content detection

The system is fully automated and self-healing!

