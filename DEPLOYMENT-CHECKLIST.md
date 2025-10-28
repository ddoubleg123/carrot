# Deployment Checklist for Render.com

## ✅ Completed Fixes (Already Deployed)

1. ✅ **Infinite Loop Fix** - Citation candidates no longer reinserted when they fail
2. ✅ **Hockey Content Cleanup** - Deleted 29 irrelevant hockey/NHL articles
3. ✅ **URL Generation** - contentUrl and urlSlug now generated for all discovered content
4. ✅ **Pagination Increase** - Limit raised from 6 to 50 items
5. ✅ **Relevance Blacklist** - Hockey terms hard-rejected for Chicago Bulls
6. ✅ **DeepSeek Integration** - Content quality audit with rejection propagation
7. ✅ **Wikimedia Entity Extraction** - Enhanced to extract player names

---

## 🔧 Required: Environment Variables on Render

The following environment variables **MUST** be set on your Render.com dashboard for the app to work correctly.

### How to Access:
1. Go to https://dashboard.render.com
2. Select your `carrot-app` service
3. Click on "Environment" in the left sidebar
4. Add/verify the following variables:

### Required Environment Variables:

#### 1. `DEEPSEEK_API_KEY`
- **Purpose**: Used for content quality audit, summarization, and relevance checking
- **How to get**: Sign up at https://platform.deepseek.com and get your API key
- **Example**: `sk-xxxxxxxxxxxxxxxxxxxxx`
- **Impact if missing**: 
  - ❌ Content summarization will fail
  - ❌ DeepSeek quality audit will not work
  - ❌ New discovered content will be rejected
  - ⚠️ Fallback summaries will be used (poor quality)

#### 2. `NEXTAUTH_URL`
- **Purpose**: Base URL for internal API calls (hero generation, content preview)
- **Value**: `https://carrot-app.onrender.com`
- **Impact if missing**:
  - ❌ AI hero image generation will fail with "Invalid URL" errors
  - ❌ Wikimedia fallback will fail
  - ❌ All tiles will show SVG placeholders instead of images

#### 3. `VAST_AI_API_KEY` (if using AI image generation)
- **Purpose**: For SDXL AI image generation via Vast.ai
- **How to get**: Sign up at https://vast.ai and get your API key
- **Impact if missing**:
  - ⚠️ AI images won't generate (will fall back to Wikimedia)

#### 4. Other Required Variables (verify these exist):
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - For session management
- `FIREBASE_*` - Firebase credentials for storage

---

## 🧪 Testing After Environment Variables Are Set

Once you've added the environment variables, you **MUST restart the service** on Render:

1. Go to your service dashboard
2. Click "Manual Deploy" → "Clear build cache & deploy"
3. Wait for deployment to complete (~5-10 minutes)

### Then test the following:

#### Test 1: Discovery Process
1. Go to https://carrot-app.onrender.com/patch/chicago-bulls
2. Click "Start Discovery"
3. **Expected behavior**:
   - ✅ New articles appear one at a time
   - ✅ Each article has a hero image (AI or Wikimedia, not SVG placeholder)
   - ✅ No infinite loops (same URL repeated)
   - ✅ No hockey/NHL content appears
   - ✅ Discovery stops after 10 items or moves to new sources
4. **Check console logs**:
   - ✅ Should see "DeepSeek processed content" with quality/relevance scores
   - ✅ Should see "AI generation attempt" or "Wikimedia fallback" for each item
   - ❌ Should NOT see "DeepSeek API failed: 403"
   - ❌ Should NOT see "Invalid URL" errors

#### Test 2: Content Modal
1. Click on any discovered content tile
2. **Expected behavior**:
   - ✅ Modal opens with full content
   - ✅ Hero image shows (not placeholder)
   - ✅ Executive Summary is complete (not truncated)
   - ✅ Key Facts are 5-8 clean facts
   - ✅ "View Source" button works and opens the article
   - ✅ URL bar shows unique URL like `/patch/chicago-bulls/content/{slug}`

#### Test 3: Content Quality
1. Open 3-5 different articles
2. **Expected behavior**:
   - ✅ All content is Bulls-specific (no generic NBA)
   - ✅ Summaries are in perfect English (no typos/grammar errors)
   - ✅ Key facts are complete sentences (no "..." trailing)
   - ✅ Relevance scores are ≥ 70%

---

## 🚨 Troubleshooting

### Issue: "Hero images still showing SVG placeholders"
**Cause**: `NEXTAUTH_URL` is missing or incorrect
**Fix**: 
1. Set `NEXTAUTH_URL=https://carrot-app.onrender.com`
2. Redeploy the service
3. Check logs for "AI generation attempt" messages

### Issue: "Discovery keeps finding the same URL"
**Cause**: Infinite loop (should be fixed now)
**Fix**: Already fixed in latest deployment. If it still happens, check logs for which candidate type is looping.

### Issue: "Content summaries are garbage text"
**Cause**: `DEEPSEEK_API_KEY` is missing or invalid
**Fix**: 
1. Verify your DeepSeek API key is correct
2. Check you have credits remaining on your DeepSeek account
3. Look for "DeepSeek API failed: 403" in logs

### Issue: "Only 6 items showing even though 10 were discovered"
**Cause**: Already fixed - pagination limit increased to 50
**Fix**: Already deployed. Refresh the page to see all items.

---

## 📊 Expected Console Logs (Good)

When everything is working correctly, you should see logs like this:

```
[Discovery Loop] ✅ New URL found: https://example.com/bulls-article
[Enrich Content] 🤖 Calling DeepSeek to summarize: Bulls Win Championship
[Enrich Content] ✅ DeepSeek processed content:
[Enrich Content]    Quality Score: 85
[Enrich Content]    Relevance Score: 92
[Enrich Content]    Is Useful: true
[AI Hero Pipeline] 🎨 Attempting AI generation for: Bulls Win Championship
[AI Hero Pipeline] ✅ AI hero generated: https://storage.googleapis.com/...
[Discovery Loop] ✅ Item 1 saved. Continuing to next candidate...
```

## 🔴 Bad Console Logs (Errors)

If you see these, you have a problem:

```
❌ [Enrich Content] DeepSeek API failed: 403
   → Missing or invalid DEEPSEEK_API_KEY

❌ [AI Hero Pipeline] Invalid URL
   → Missing or incorrect NEXTAUTH_URL

❌ [Discovery Loop] ⏭️  Skipping duplicate: https://sfgate.com/... (repeated 100 times)
   → Infinite loop - should be fixed now

❌ [pickHero] No real media found, will use fallback
   → Hero generation failed, check both env vars above
```

---

## ✅ Final Checklist

Before considering the deployment complete, verify:

- [ ] `DEEPSEEK_API_KEY` is set on Render
- [ ] `NEXTAUTH_URL` is set to `https://carrot-app.onrender.com`
- [ ] Service has been restarted after adding env vars
- [ ] Discovery process completes without errors
- [ ] All tiles show real images (not SVG placeholders)
- [ ] Content modals open with complete summaries
- [ ] No hockey/NHL content appears on Bulls page
- [ ] Discovery doesn't loop on the same URL
- [ ] All 10+ discovered items are visible

---

## 📝 Notes

- The discovery process will now **automatically reject** low-quality or irrelevant content before saving
- DeepSeek scores content on **quality** (0-100) and **relevance** (0-100) and rejects anything below thresholds
- Hero images prioritize: **AI generated → Wikimedia → OG image → placeholder**
- URL slugs are automatically generated for all new content
- The infinite loop fix prevents citation candidates from being reinserted when they fail

If you encounter any issues not covered here, check the Render logs for detailed error messages.

