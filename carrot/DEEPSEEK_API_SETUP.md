# DeepSeek API Configuration

## ⚠️ Required for Citation Processing

The citation processing system requires DeepSeek API to score and evaluate citations. Without it, all citations default to score 50 and are rejected.

## 🔧 Setup Steps

### For Production (Render)

1. **Add API Key to Database**
   - Go to Render Dashboard > carrot-db
   - Add a new property: `deepseek_api_key`
   - Value: Your DeepSeek API key from https://platform.deepseek.com/

2. **Verify render.yaml**
   - The `DEEPSEEK_API_KEY` environment variable is configured in `render.yaml`
   - It reads from database property: `deepseek_api_key`

3. **Redeploy**
   - After adding the key to the database, redeploy the app
   - The API key will be available as `process.env.DEEPSEEK_API_KEY`

### For Local Development

1. **Create `.env` file** in the `carrot` directory:
   ```bash
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   DATABASE_URL=your_database_url
   ```

2. **Get API Key**
   - Go to https://platform.deepseek.com/
   - Sign up or log in
   - Navigate to API Keys section
   - Create a new API key
   - Copy and add to `.env` file

3. **Test Configuration**
   ```bash
   # Check if key is loaded
   node -e "require('dotenv').config(); console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET')"
   ```

## ✅ Verification

After configuration, test with:
```bash
ts-node scripts/process-all-citations.ts --patch=israel --batch-size=1 --limit=1
```

You should see:
- `[DeepSeek] DEEPSEEK_API_KEY exists: true`
- Real AI scores (not default 50)
- Citations being saved based on actual relevance

## 🚨 Current Status

- **Production**: API key needs to be added to database
- **Local**: API key needs to be in `.env` file
- **Scripts**: Will use `dotenv/config` to load from `.env`

