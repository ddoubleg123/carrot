# Quick Start - Render Deployment

## 🚀 Fast Track Deployment

### 1. Generate CRON_SECRET

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Online generator
# Visit: https://www.random.org/strings/
# Length: 64, Characters: Hexadecimal
```

**Save this value** - you'll need it for the cron job.

### 2. Add Environment Variables

In Render Dashboard → Your Service → Environment:

```
CRON_SECRET=<paste-generated-secret-here>
SELF_AUDIT_INTERVAL=3600000
```

### 3. Create Cron Job

Render Dashboard → Cron Jobs → New Cron Job:

**Settings:**
- Name: `Self-Audit Hourly`
- Schedule: `0 * * * *`
- Command:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP.onrender.com/api/cron/self-audit
  ```
- Environment: Select your web service

### 4. Test It Works

```bash
# Replace YOUR-APP and YOUR-SECRET
curl -H "Authorization: Bearer YOUR-SECRET" \
  https://YOUR-APP.onrender.com/api/cron/self-audit
```

Should return JSON with results.

### 5. Verify Health Check

```bash
curl https://YOUR-APP.onrender.com/api/system/health-check
```

Should return `"status": "healthy"`.

## ✅ Done!

The system will now:
- ✅ Run self-audit every hour automatically
- ✅ Fix untitled items
- ✅ Link AgentMemory entries
- ✅ Reset stuck queue items
- ✅ Monitor system health

## 📊 Monitor

Check logs in Render Dashboard → Your Service → Logs

Look for:
- `[Self-Audit]` entries every hour
- `✅ Self-audit complete` messages
- Any errors or warnings

## 🔧 Optional: Background Worker

For better performance, create a Background Worker:

1. Render Dashboard → New → Background Worker
2. Name: `Agent Feed Worker`
3. Start Command: `npx tsx scripts/auto-feed-worker.ts`
4. Copy all environment variables from web service

This will process the feed queue continuously.

## 🆘 Troubleshooting

**Cron not running?**
- Check cron job is enabled
- Verify CRON_SECRET matches
- Check cron job logs

**Health check failing?**
- Check database connection
- Review service logs
- Verify environment variables

**Need help?**
- Check `RENDER-DEPLOYMENT-GUIDE.md` for detailed steps
- Review `DEPLOYMENT-CHECKLIST.md` for full checklist

