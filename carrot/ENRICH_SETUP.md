# Enrich API Setup Guide

## 🔑 INTERNAL_ENRICH_TOKEN

The `INTERNAL_ENRICH_TOKEN` is a secret token used to authenticate internal API calls to `/api/internal/enrich/:id`.

### How to Generate

You can generate a secure random token using:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32

# Or use any secure random string generator
```

### Current Token (in render.yaml)
```
4bb80990b778a43420a53bdc4d8b0152c40a191e9dc6f4b1fcfaa419983dcdde
```

**⚠️ Important**: This token should be kept secret and only used for internal service-to-service communication.

## 🌐 Base URL Configuration

### Current Production URL
- **Render**: `https://carrot-app.onrender.com`
- **Final Domain**: `gotcarrot.com` (when ready)

The `enrichClient.ts` automatically uses:
1. `ENRICH_BASE_URL` (if set)
2. `BASE_URL` (if set)
3. `NEXTAUTH_URL` (fallback, currently set to `https://carrot-app.onrender.com`)

### Setting in Render

1. Go to your Render dashboard
2. Select the `carrot-app` service
3. Go to **Environment** tab
4. Add these environment variables:

```
INTERNAL_ENRICH_TOKEN=4bb80990b778a43420a53bdc4d8b0152c40a191e9dc6f4b1fcfaa419983dcdde
ENRICH_BASE_URL=https://carrot-app.onrender.com
```

Or update `render.yaml` (already done) and redeploy.

## 🧪 Testing

### Local Test
```bash
# Set env vars
export INTERNAL_ENRICH_TOKEN=4bb80990b778a43420a53bdc4d8b0152c40a191e9dc6f4b1fcfaa419983dcdde
export ENRICH_BASE_URL=https://carrot-app.onrender.com

# Run smoke test
npm run smoke:enrich
```

### Production Test
```bash
# From your local machine (with env vars set)
npm run smoke:enrich
```

## 🔄 When Moving to gotcarrot.com

When you're ready to switch to the final domain:

1. Update `NEXTAUTH_URL` in Render to `https://gotcarrot.com`
2. Update `ENRICH_BASE_URL` to `https://gotcarrot.com`
3. Redeploy the service

The enrich client will automatically use the new URL.

## 📝 Usage in Code

```typescript
import { postEnrich } from '@/lib/discovery/enrichClient'

// Call enrich API
await postEnrich(contentId, {
  sourceUrl: 'https://example.com/article',
  type: 'article',
  title: 'Article Title'
})
```

## 🔒 Security Notes

- The token is checked on every `/api/internal/enrich/:id` request
- Missing or invalid token returns 401 Unauthorized
- Token should be different from other secrets (NEXTAUTH_SECRET, etc.)
- Rotate the token if compromised

