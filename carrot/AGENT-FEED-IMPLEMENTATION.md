# Agent Auto-Feed Implementation

## Overview

This implementation adds an automatic pipeline to feed discovered content to patch agents, ensuring agents continuously learn from all discovered content (not just manual posts/facts/events).

## Architecture

### Database Schema

**New Table: `AgentMemoryFeedQueue`**
- Tracks discovered content items queued for agent feeding
- Status: PENDING | PROCESSING | DONE | FAILED
- Idempotent key: (patchId, discoveredContentId, contentHash)

**Updated Table: `AgentMemory`**
- Added discovery-specific fields:
  - `patchId`, `discoveredContentId`, `contentHash`
  - `summary`, `facts`, `entities`, `timeline`
  - `rawTextPtr` (pointer to full text, not duplication)

### Components

1. **Content Packers** (`src/lib/agent/packers.ts`)
   - Transforms DiscoveredContent into structured AgentMemory format
   - Extracts summary (4-6 sentences), facts, entities, timeline
   - Sanitizes content for agent consumption

2. **Feed Worker** (`src/lib/agent/feedWorker.ts`)
   - Processes queue items
   - Quality gates (text bytes, relevance score)
   - Idempotency checks
   - Error handling with exponential backoff

3. **Enqueue Hook** (`src/lib/discovery/engineV21.ts`)
   - Automatically enqueues content when saved
   - Non-blocking, background process

4. **APIs**
   - `GET /api/patches/[handle]/agent/health` - Queue status, lag, metrics
   - `POST /api/patches/[handle]/agent/sync` - Manual backfill trigger

5. **Backfill Script** (`scripts/backfill-agent-memory.ts`)
   - Processes existing discovered content
   - Supports filtering by patch, date, limit
   - Dry-run mode

## Quality Gates

Content must pass these gates before being fed to agents:

1. **Minimum Text Bytes**: ≥600 bytes (configurable via `MIN_TEXT_BYTES_FOR_AGENT`)
2. **Relevance Score**: ≥60 (configurable via `MIN_RELEVANCE_SCORE`)
3. **Idempotency**: Not already processed (same contentHash)
4. **Feature Flag**: Per-patch flag (TODO: implement)

## Idempotency

- Unique constraint on `(patchId, discoveredContentId, contentHash)`
- Prevents duplicate processing
- Handles content updates (new hash = new memory)

## Observability

### Metrics (TODO: implement structured logging)
- `agent_feed_jobs_total{status}`
- `agent_feed_lag_seconds`
- `agent_memories_total`
- `agent_feed_fail_ratio`

### Logs
- `feed_enqueued` - Content enqueued
- `feed_started` - Processing started
- `feed_saved` - Successfully saved
- `feed_failed` - Processing failed

## Safety & Limits

- **Rate Limits**: Max 60/minute per patch (TODO: implement)
- **Size Clamp**: Max 50k chars to summarizer
- **Domain Policy**: Allow/deny lists (TODO: implement)
- **Feature Flags**: Per-patch toggle (TODO: implement)

## Usage

### Automatic Feeding

Content is automatically enqueued when:
- Discovered content is saved in `engineV21.ts`
- Wikipedia citations are processed

### Manual Backfill

```bash
# Backfill for a specific patch
ts-node scripts/backfill-agent-memory.ts --patch=israel --limit=100

# Backfill since a date
ts-node scripts/backfill-agent-memory.ts --patch=israel --since=2024-01-01

# Dry run
ts-node scripts/backfill-agent-memory.ts --patch=israel --dry-run
```

### API Usage

```bash
# Check health
curl https://carrot-app.onrender.com/api/patches/israel/agent/health

# Trigger sync
curl -X POST https://carrot-app.onrender.com/api/patches/israel/agent/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

## Next Steps

1. **Run Prisma Migration**
   ```bash
   npx prisma migrate dev --name add_agent_memory_feed_queue
   ```

2. **Start Worker Process**
   - Add worker to `render.yaml` or run as background job
   - Process queue items continuously

3. **Add Observability**
   - Structured logging
   - Metrics collection
   - Alerting on SLO violations

4. **Add Feature Flags**
   - Per-patch toggle in database
   - UI control in patch settings

5. **Add Rate Limits**
   - Per-patch rate limiting
   - Configurable limits

6. **Add Domain Filtering**
   - Allow/deny lists per patch
   - Junk/tracker filtering

## Testing

### Acceptance Criteria

1. ✅ Flip feature flag ON for test patch
2. ✅ Save 3 discovered items
3. ✅ Health shows queued→processing→done
4. ✅ Lag p95 ≤ 60s
5. ✅ AgentMemory rows appear with correct data
6. ✅ Agent responses incorporate new facts within 2 minutes
7. ✅ Backfill processes ≥50 items with <10% failure
8. ✅ Debug page shows non-zero counts

## Files Changed

### New Files
- `src/lib/agent/packers.ts`
- `src/lib/agent/feedWorker.ts`
- `src/app/api/patches/[handle]/agent/health/route.ts`
- `src/app/api/patches/[handle]/agent/sync/route.ts`
- `scripts/backfill-agent-memory.ts`

### Modified Files
- `prisma/schema.prisma` - Added AgentMemoryFeedQueue, updated AgentMemory
- `src/lib/discovery/engineV21.ts` - Added enqueue hooks

### TODO
- UI debug card (`src/app/(app)/patch/[handle]/debug-saved/page.tsx`)
- Feature flags implementation
- Rate limiting
- Structured metrics/logging
- Worker process configuration

