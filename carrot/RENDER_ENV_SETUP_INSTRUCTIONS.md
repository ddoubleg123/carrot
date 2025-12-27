# Render Environment Variables Setup - Exact Instructions

## ✅ Already Configured (in render.yaml)
- **REDIS_URL** - Already set with your Redis URL

## ⚠️ Need to Add Manually

You need to add **ONE** environment variable in the Render Dashboard:

### Step 1: Go to Your App Service
1. Go to https://dashboard.render.com
2. Click on **`carrot-app`** (your web service, NOT the database)

### Step 2: Go to Environment Tab
1. In the left sidebar, click **"Environment"**
2. You should see a list of existing environment variables

### Step 3: Add NEWS_API_KEY
1. Scroll down to find the "Environment Variables" section
2. Click **"Add Environment Variable"** or **"+ Add"** button
3. Enter:
   - **Key:** `NEWS_API_KEY`
   - **Value:** Your NewsAPI key (get it from https://newsapi.org)
4. Click **"Save Changes"**

### Step 4: Restart Service
1. After adding the variable, click **"Manual Deploy"** → **"Deploy latest commit"** 
   OR
2. Go to the service and click **"Restart"** button

---

## How to Get NewsAPI Key

1. Go to https://newsapi.org
2. Click **"Get API Key"** (free tier available)
3. Sign up or log in
4. Copy your API key from the dashboard
5. Use that key as the value for `NEWS_API_KEY`

---

## Verify It's Working

After restarting, check your service logs. You should see:
- ✅ `[NewsAPI] Searching for: "..."` (when news searches run)
- ❌ `[NewsAPI] API key not configured` (means it's not set yet)

---

**That's it!** Just add `NEWS_API_KEY` to your `carrot-app` service's Environment tab.

