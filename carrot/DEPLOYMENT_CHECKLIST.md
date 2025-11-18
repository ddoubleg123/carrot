# Crawler Deployment Checklist

## ✅ Pre-Deployment (Code Complete)

- [x] All crawler code implemented
- [x] Structured JSON logging added
- [x] Redis queues configured
- [x] Prisma schema updated (CrawlerPage, CrawlerExtraction)
- [x] API endpoints created (`/api/crawler/run`, `/api/admin/crawler`)
- [x] Admin dashboard page created (`/admin/crawler`)
- [x] Import paths fixed

## 🚀 Deployment Steps

### 1. Environment Variables (Render Dashboard)

Set these in your Render production environment:

```bash
# Required
REDIS_URL=rediss://... (existing)
DATABASE_URL=postgresql://... (existing)
LLM_API_KEY=sk-... (DeepSeek or equivalent)

# Optional (with defaults)
LLM_MODEL=deepseek
MAX_PER_DOMAIN=3
WIKI_CAP=2
FETCH_TIMEOUT_MS=15000
CRAWLER_PRIORITY_V2=true
EXTRACTOR_V2=true
ZERO_ALERT_WINDOW_MIN=5
```

### 2. Deploy to Render

The `postinstall` script in `package.json` will automatically run `prisma generate` during deployment, which will:
- Regenerate Prisma client with `CrawlerPage` and `CrawlerExtraction` models
- Remove the need for `(prisma as any)` workarounds

**Deploy command:**
```bash
git push origin main
```

Render will:
1. Run `npm install` (which triggers `postinstall: prisma generate`)
2. Run `npm run build`
3. Deploy the app

### 3. Verify Prisma Migration

After deployment, check that migrations are applied:

```bash
# In Render shell or locally with DATABASE_URL set
npx prisma migrate status
```

Should show: `15 migrations found` (or more if new migrations were added)

## 🧪 Testing Steps

### Test 1: Health Check

```bash
curl https://carrot-app.onrender.com/api/admin/crawler
```

**Expected:** JSON response with crawler stats (or 503 if Prisma client not regenerated yet)

### Test 2: Start a Crawler Run

```bash
curl -X POST https://carrot-app.onrender.com/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "artificial intelligence",
    "durationMinutes": 2,
    "maxPages": 10
  }'
```

**Expected:** `{"ok": true, "message": "Crawler run started", ...}`

### Test 3: Monitor Logs

In Render dashboard, check logs for:
- `{"level":"info","service":"crawler","step":"start",...}`
- `{"level":"info","service":"crawler","step":"fetch",...}`
- `{"level":"info","service":"crawler","step":"persist",...}`

### Test 4: Check Admin Dashboard

Visit: `https://carrot-app.onrender.com/admin/crawler`

**Expected:** Dashboard showing:
- Total pages crawled
- Queue depths
- Top domains
- Recent extractions

### Test 5: Run Test Script (Local)

```bash
cd carrot
yarn crawler:test
```

This runs a 2-minute test with topic "test-crawl"

## 📊 Monitoring

### Key Metrics to Watch

1. **Queue Depths** (`/api/admin/crawler`)
   - `discoveryQueueDepth`: Should be > 0 during active runs
   - `extractionQueueDepth`: Should grow as pages are fetched

2. **Structured Logs** (Render logs)
   - Look for `"step":"persist"` with `"status":"ok"` - indicates successful saves
   - Look for `"type":"slow_query"` - indicates DB performance issues
   - Look for `"step":"zero_results_alert"` - indicates discovery stopped finding items

3. **Zero Results Alert**
   - If you see `"step":"zero_results_alert"` in logs, the crawler detected no items saved in the alert window
   - Check reason codes: `robots_blocked`, `duplicate`, `content_too_short`, etc.

### Generate Report

```bash
cd carrot
yarn report:zero
```

Shows:
- Reason code breakdown
- Top domains
- Wikipedia vs non-Wikipedia ratio
- Content length distribution

## 🔧 Troubleshooting

### Issue: Prisma Client Not Regenerated

**Symptom:** `/api/admin/crawler` returns 503 with "Prisma client not regenerated"

**Fix:**
1. Check Render build logs - should show `prisma generate` running
2. If not, manually trigger in Render shell:
   ```bash
   npx prisma generate
   ```
3. Restart the service

### Issue: Zero Results

**Symptom:** Crawler runs but `itemsSaved=0` in logs

**Debug:**
1. Check `/api/admin/crawler` for reason code breakdown
2. Run `yarn report:zero` for detailed analysis
3. Check logs for `"reason_code"` values:
   - `robots_blocked`: Site blocking crawler
   - `duplicate`: URL or content already seen
   - `content_too_short`: Page too short (< 500 chars)
   - `http_403`: Access forbidden

### Issue: Redis Connection Errors

**Symptom:** `REDIS_URL must be set` errors

**Fix:**
1. Verify `REDIS_URL` is set in Render environment
2. Check Redis service is running
3. Test connection: `redis-cli -u $REDIS_URL ping`

### Issue: LLM Extraction Failing

**Symptom:** Pages fetched but no extractions created

**Debug:**
1. Check `LLM_API_KEY` is set correctly
2. Check logs for `"step":"extract"` errors
3. Verify DeepSeek API is accessible from Render

## 📝 Next Steps After Deployment

1. **Monitor First Run**: Watch logs for first 10 minutes
2. **Check Admin Dashboard**: Verify pages are being saved
3. **Review Logs**: Look for any errors or warnings
4. **Adjust Config**: Tune `MAX_PER_DOMAIN`, `WIKI_CAP` based on results
5. **Set Up Alerts**: Configure Render alerts for zero results or errors

## 🎯 Success Criteria

- ✅ `/api/crawler/run` returns 202
- ✅ Logs show `"step":"persist"` with `"status":"ok"`
- ✅ Admin dashboard shows pages being crawled
- ✅ No `"zero_results_alert"` in logs during active runs
- ✅ Extractions are being created (check `CrawlerExtraction` table)

