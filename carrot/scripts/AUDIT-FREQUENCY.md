# Self-Audit Frequency

## Automatic Auditing Frequency

### 1. **Real-Time (Event-Driven) - PRIMARY METHOD**
**When:** Every time content is saved during discovery

**Frequency:** **Every discovery run** - happens immediately when content is saved

**Location:** `orchestrator.ts` lines 1569-1592

**What it does:**
- Checks if hero image is missing/placeholder
- If yes → Automatically triggers `enrichContentId()`
- Hero image generated and saved
- **No delay, no schedule - happens instantly**

**Example:**
```
Discovery finds "Israel Rising" book
  → Content saved to database
  → [AUTOMATIC CHECK] Hero missing?
  → [AUTOMATIC FIX] Generate hero image
  → Database updated
  → Done! ✅
```

### 2. **Scheduled (Optional) - For Existing Content**
**When:** Via cron job (if configured)

**Frequency:** Configurable (e.g., every hour, daily, weekly)

**Location:** `/api/cron/self-audit` endpoint

**What it does:**
- Scans all existing content
- Fixes any items with missing heroes or grammar issues
- Useful for fixing content created before automatic system was in place

**Setup:**
```bash
# Render Cron Job
Schedule: 0 * * * *  (every hour)
Command: curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/self-audit
```

### 3. **Auto-Feed Worker (If Running)**
**When:** Every hour (configurable)

**Frequency:** `SELF_AUDIT_INTERVAL` environment variable (default: 1 hour)

**Location:** `auto-feed-worker.ts`

**What it does:**
- Runs self-audit as part of feed worker
- Fixes untitled items, stuck queue items, etc.

## Summary

**For NEW content (Anna's Archive, Wikipedia, etc.):**
- ✅ **Automatic, real-time** - Happens during every discovery run
- ✅ **No schedule needed** - Event-driven, instant
- ✅ **Zero manual intervention** - Works automatically

**For EXISTING content:**
- ⚠️ **Manual or scheduled** - Run scripts or set up cron
- ⚠️ **One-time fix** - After fixing existing content, new content is automatic

## Recommendation

**You don't need to set up a schedule!** The automatic system handles all new content.

Only set up a cron job if you want to:
- Fix existing content automatically
- Run periodic maintenance audits
- Catch any edge cases that slipped through

## Current Status

✅ **Automatic system is active** - Runs during every discovery
⚠️ **No cron job configured yet** - Only needed for existing content fixes

