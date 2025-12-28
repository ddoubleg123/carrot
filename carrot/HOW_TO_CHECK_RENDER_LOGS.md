# How to Check Render Logs

Since I cannot directly access Render logs, here's how to check them:

## Steps to Check Logs

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Log in to your account

2. **Navigate to Your Service**
   - Click on `carrot-app` service
   - Click "Logs" in the left sidebar

3. **Search for the Error**
   - **Time Range:** Around Dec 27, 2025 23:06:55 UTC (when engine stopped)
   - **Search Terms:** 
     - `Error`
     - `Exception`
     - `crash`
     - `EngineV21`
     - `frontier_pop`
     - `discoveryLoop`
     - `processCandidate`

4. **What to Look For**
   - Stack traces
   - Unhandled promise rejections
   - Memory errors (OOM)
   - Redis connection errors
   - Database connection errors
   - Timeout errors
   - Any error around the timestamp when processing stopped

5. **Copy the Error**
   - Copy the full error message and stack trace
   - Note the exact timestamp
   - Document what the error says

## Alternative: Check via API

If Render has a logs API, you could:
```bash
# Check if Render CLI is installed
render --help

# Or use Render API (if available)
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/[service-id]/logs
```

## What We're Looking For

The discovery engine stopped after processing 1 frontier item. We need to find:
- **Why it stopped** - What error/exception occurred?
- **Where it stopped** - Which function/operation failed?
- **How to fix it** - What code needs to be fixed?

Once we have the error from Render logs, we can:
1. Identify the root cause
2. Fix the issue
3. Prevent it from happening again
4. Restart discovery to process all sources

