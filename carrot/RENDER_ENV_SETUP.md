# Render Environment Variables Setup

## Required Database Properties

After deploying code changes, you need to add these properties to your `carrot-db` database in Render:

1. **Go to Render Dashboard** → Your Database → "Properties" tab

2. **Add the following properties:**

   - `news_api_key` - Your NewsAPI key from https://newsapi.org
   - `redis_url` - Your Redis connection URL

### Getting the Values:

#### NEWS_API_KEY
1. Sign up at https://newsapi.org (free tier available)
2. Get your API key from the dashboard
3. Add to database property: `news_api_key`

#### REDIS_URL
You have two options:

**Option A: Use Existing Redis (if you have one)**
- Get the connection string from your Redis provider
- Format: `redis://username:password@host:port` or `rediss://username:password@host:port` (for TLS)

**Option B: Create Redis Service on Render**
1. Go to Render Dashboard
2. Click "New +" → "Redis"
3. Choose plan (Free tier available)
4. Copy the "Internal Redis URL" or "External Redis URL"
5. Add to database property: `redis_url`

**Note:** If using Render Redis, the internal URL is faster but only works within Render's network. External URL works from anywhere.

### After Adding Properties:

The environment variables will be automatically injected into your app:
- `NEWS_API_KEY` - Will read from `news_api_key` database property
- `REDIS_URL` - Will read from `redis_url` database property

### Verification:

After deployment, check logs to confirm:
- `[NewsAPI] Searching for: "..."` should appear (not "API key not configured")
- `REDIS_URL` errors should stop appearing

