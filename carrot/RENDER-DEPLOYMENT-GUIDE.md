# Render Deployment Guide

## Self-Audit and Auto-Fix System Setup

### 1. Environment Variables

Add these to your Render service environment:

```bash
# Self-audit interval (1 hour in milliseconds)
SELF_AUDIT_INTERVAL=3600000

# Cron authentication (generate a secure random string)
CRON_SECRET=your-secure-random-string-here

# Feed worker settings (optional, defaults shown)
AGENT_FEED_INTERVAL=10000
AGENT_FEED_BATCH_SIZE=20
AGENT_FEED_VERIFY_INTERVAL=60000
```

### 2. Set Up Cron Job for Self-Audit

#### Option A: Render Cron Job (Recommended)

1. Go to Render Dashboard → Your Service → Cron Jobs
2. Click "New Cron Job"
3. Configure:
   - **Name**: `Self-Audit Hourly`
   - **Schedule**: `0 * * * *` (every hour at minute 0)
   - **Command**: 
     ```bash
     curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/self-audit
     ```
   - **Environment**: Same as your web service

#### Option B: External Cron Service

Use a service like:
- **cron-job.org**
- **EasyCron**
- **GitHub Actions** (if using GitHub)

Schedule: `0 * * * *` (every hour)

Command:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.onrender.com/api/cron/self-audit
```

### 3. Set Up Auto-Feed Worker

#### Option A: Background Worker Service (Recommended)

1. Create a new **Background Worker** service in Render
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npx tsx scripts/auto-feed-worker.ts`
4. **Environment**: Copy all env vars from web service
5. **Plan**: Free tier is fine for this

#### Option B: Run in Web Service (Not Recommended)

You can run the worker in the same service, but it's better to separate:

```bash
# In your start command, run both:
npm start & npx tsx scripts/auto-feed-worker.ts
```

### 4. Health Check Monitoring

Set up monitoring for the health check endpoint:

#### Render Health Check

1. Go to your service settings
2. Set **Health Check Path**: `/api/system/health-check`
3. Render will monitor this endpoint

#### External Monitoring

Use services like:
- **UptimeRobot**
- **Pingdom**
- **StatusCake**

Monitor: `https://your-app.onrender.com/api/system/health-check`

Expected response:
```json
{
  "status": "healthy",
  "checks": { ... }
}
```

### 5. Verify Deployment

After deployment, verify everything works:

```bash
# 1. Check health
curl https://your-app.onrender.com/api/system/health-check

# 2. Test self-audit (manual)
curl -X POST https://your-app.onrender.com/api/system/self-audit

# 3. Test cron endpoint (with auth)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.onrender.com/api/cron/self-audit

# 4. Check feed queue processing
curl https://your-app.onrender.com/api/agent-feed/verify
```

### 6. Monitoring and Alerts

#### Check Logs

Render Dashboard → Your Service → Logs

Look for:
- `[AutoFeedWorker]` - Feed worker activity
- `[Self-Audit]` - Self-audit runs
- `✅ Self-audit complete` - Successful audits

#### Set Up Alerts

1. **Health Check Alerts**: If status != "healthy"
2. **Error Alerts**: If error count > 0
3. **Queue Alerts**: If pending items > 100

### 7. Troubleshooting

#### Self-Audit Not Running

1. Check cron job logs in Render
2. Verify `CRON_SECRET` matches
3. Check API endpoint is accessible
4. Review service logs for errors

#### Feed Worker Not Processing

1. Verify worker service is running
2. Check database connection
3. Review worker logs
4. Verify environment variables

#### Health Check Failing

1. Check database connectivity
2. Review error messages in response
3. Check service logs
4. Verify all dependencies installed

### 8. Performance Tuning

Adjust intervals based on load:

```bash
# For high load
AGENT_FEED_INTERVAL=5000        # 5 seconds
AGENT_FEED_BATCH_SIZE=50        # Larger batches
SELF_AUDIT_INTERVAL=1800000     # 30 minutes

# For low load
AGENT_FEED_INTERVAL=30000       # 30 seconds
AGENT_FEED_BATCH_SIZE=10        # Smaller batches
SELF_AUDIT_INTERVAL=7200000     # 2 hours
```

### 9. Security Notes

- **CRON_SECRET**: Use a strong random string (32+ characters)
- **API Endpoints**: Consider adding IP whitelist for cron endpoint
- **Rate Limiting**: Monitor for abuse on public endpoints

### 10. Cost Considerations

- **Free Tier**: Sufficient for small to medium deployments
- **Background Worker**: Separate service uses minimal resources
- **Cron Jobs**: Free on Render
- **API Calls**: Minimal cost, mostly internal

## Quick Start Checklist

- [ ] Add environment variables to Render
- [ ] Set up cron job for self-audit
- [ ] Create background worker service (optional)
- [ ] Configure health check monitoring
- [ ] Test all endpoints
- [ ] Set up alerts
- [ ] Monitor logs for first 24 hours

## Support

If issues arise:
1. Check service logs
2. Review health check endpoint
3. Test endpoints manually
4. Check environment variables
5. Verify database connectivity

