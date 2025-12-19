# Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Ready
- [x] All code committed to git
- [x] All scripts tested locally
- [x] No linter errors
- [x] Documentation complete

### ⏳ Before Deploying to Render

1. **Review Environment Variables**
   - [ ] `DEEPSEEK_API_KEY` is set
   - [ ] `DATABASE_URL` is configured
   - [ ] `CRON_SECRET` is set (generate a secure random string)
   - [ ] `SELF_AUDIT_INTERVAL=3600000` (optional, defaults to 1 hour)
   - [ ] `AGENT_FEED_INTERVAL=10000` (optional, defaults to 10 seconds)

2. **Test Locally** (if possible)
   ```bash
   # Test self-audit
   npx tsx scripts/self-audit-and-fix.ts --patch=israel
   
   # Test health check (if server running)
   curl http://localhost:3000/api/system/health-check
   ```

## Render Deployment Steps

### Step 1: Deploy Code
- [ ] Push to git (already done ✅)
- [ ] Render will auto-deploy if connected to git
- [ ] Or manually trigger deployment in Render dashboard
- [ ] Wait for build to complete
- [ ] Verify deployment successful

### Step 2: Set Environment Variables
Go to Render Dashboard → Your Service → Environment

Add/Verify:
```bash
CRON_SECRET=<generate-secure-random-string>
SELF_AUDIT_INTERVAL=3600000
AGENT_FEED_INTERVAL=10000
AGENT_FEED_BATCH_SIZE=20
AGENT_FEED_VERIFY_INTERVAL=60000
```

### Step 3: Set Up Cron Job
Go to Render Dashboard → Cron Jobs → New Cron Job

**Configuration:**
- **Name**: `Self-Audit Hourly`
- **Schedule**: `0 * * * *` (every hour at minute 0)
- **Command**: 
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/self-audit
  ```
- **Environment**: Select your web service
- **Plan**: Free tier is fine

**Generate CRON_SECRET:**
```bash
# On your local machine or Render shell
openssl rand -hex 32
# Or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Set Up Background Worker (Optional but Recommended)
Go to Render Dashboard → New → Background Worker

**Configuration:**
- **Name**: `Agent Feed Worker`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npx tsx scripts/auto-feed-worker.ts`
- **Environment**: Copy all env vars from web service
- **Plan**: Free tier is fine

### Step 5: Configure Health Check
Go to Render Dashboard → Your Service → Settings

- **Health Check Path**: `/api/system/health-check`
- **Health Check Interval**: 60 seconds

### Step 6: Verify Deployment

#### Test Health Check
```bash
curl https://your-app.onrender.com/api/system/health-check
```

Expected response:
```json
{
  "status": "healthy",
  "checks": { ... }
}
```

#### Test Self-Audit (Manual)
```bash
curl -X POST https://your-app.onrender.com/api/system/self-audit
```

#### Test Cron Endpoint (with auth)
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.onrender.com/api/cron/self-audit
```

#### Check Feed Queue
```bash
curl https://your-app.onrender.com/api/agent-feed/verify
```

### Step 7: Monitor Logs

Go to Render Dashboard → Your Service → Logs

Look for:
- `[AutoFeedWorker]` - Feed worker activity
- `[Self-Audit]` - Self-audit runs
- `✅ Self-audit complete` - Successful audits
- Any errors or warnings

### Step 8: Run Initial Fixes

After deployment, run these once:

```bash
# Fix missing citation heroes (if needed)
# This would need to be run from Render shell or via API
# Or wait for self-audit to catch them

# Check system status
curl https://your-app.onrender.com/api/system/health-check
```

## Post-Deployment Verification

### Day 1 Checks
- [ ] Health check returns "healthy"
- [ ] Self-audit runs at scheduled time (check logs)
- [ ] Feed worker processes queue items
- [ ] No critical errors in logs
- [ ] AgentMemory entries being created

### Week 1 Monitoring
- [ ] Self-audit fixes issues automatically
- [ ] Feed queue stays healthy
- [ ] No stuck items accumulating
- [ ] Titles are correct (not "Untitled")
- [ ] Agent learning is working

## Troubleshooting

### Health Check Failing
1. Check database connection
2. Review error messages
3. Check service logs
4. Verify environment variables

### Self-Audit Not Running
1. Check cron job is enabled
2. Verify `CRON_SECRET` matches
3. Check cron job logs
4. Verify API endpoint is accessible

### Feed Worker Not Processing
1. Verify worker service is running
2. Check database connection
3. Review worker logs
4. Verify environment variables

### AgentMemory Not Created
1. Check feed queue status
2. Verify feed worker is running
3. Check for errors in logs
4. Run manual feed processing

## Quick Reference

### API Endpoints
- Health: `GET /api/system/health-check`
- Self-Audit: `POST /api/system/self-audit`
- Cron: `GET /api/cron/self-audit` (requires auth)
- Feed Verify: `GET /api/agent-feed/verify`
- Feed Process: `POST /api/agent-feed/process-all`

### Scripts
- Self-Audit: `npx tsx scripts/self-audit-and-fix.ts --patch=israel`
- System Status: `npx tsx scripts/check-live-system-status.ts`
- Fix Heroes: `npx tsx scripts/fix-missing-citation-heroes.ts --patch=israel --live`

### Environment Variables
- `CRON_SECRET` - Required for cron endpoint
- `SELF_AUDIT_INTERVAL` - Optional (default: 3600000ms = 1 hour)
- `AGENT_FEED_INTERVAL` - Optional (default: 10000ms = 10 seconds)

## Success Criteria

✅ **Deployment Successful When:**
- Health check returns "healthy"
- Self-audit runs automatically
- Feed worker processes items
- No critical errors
- System fixes issues automatically

## Next Steps After Deployment

1. Monitor for 24 hours
2. Review logs daily
3. Check health endpoint regularly
4. Adjust intervals if needed
5. Set up external monitoring (optional)

