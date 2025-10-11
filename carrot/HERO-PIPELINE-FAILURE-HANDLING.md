# 🛡️ Hero Pipeline - Failure Handling & Fallback Strategy

## 🎯 **The 10-15% "Fail Rate" Explained**

The **10-15% "fail rate"** doesn't mean cards show broken images or errors. It means those items fall through to **Tier 4 (Generated Covers)** instead of getting real media from Tiers 1-3.

---

## 📊 **Expected Success Rate Breakdown**

| Tier | Source | Success Rate | Cumulative |
|------|--------|--------------|------------|
| **Tier 1** | Open Graph / oEmbed | 70-90% | **70-90%** |
| **Tier 2** | Inline Images | ~40% of remaining | **80-85%** |
| **Tier 3** | Video / PDF / Image | ~95% of media | **85-90%** |
| **Tier 4** | **Generated Covers** | **100%** | **100%** |

So the "10-15% fail rate" really means:
- ✅ **85-90% get REAL hero images** (photos, video frames, etc.)
- ✅ **10-15% get TASTEFUL GENERATED COVERS** (no letters, professional SVG)
- ❌ **0% get flat gradients or broken images**

---

## 🔄 **Cascading Fallback Flow**

Here's what happens step-by-step when content is enriched:

### **Step 1: Try Tier 1 (OG/oEmbed)**
```typescript
// Try Open Graph
const ogResult = await getOpenGraphImage(url)
if (ogResult) {
  return proxyDecorate(ogResult.url, 'og') // ✅ Success!
}

// Try oEmbed (YouTube, Vimeo, Twitter)
const oembedResult = await getOEmbedImage(url)
if (oembedResult) {
  return proxyDecorate(oembedResult.url, 'oembed') // ✅ Success!
}
```

**Why it fails:**
- URL doesn't have og:image meta tags
- oEmbed provider not supported
- Image URL is broken/inaccessible

---

### **Step 2: Try Tier 2 (Inline Images)**
```typescript
// Only for articles
if (type === 'article') {
  const inlineResult = await getFirstInlineImage(url)
  if (inlineResult) {
    return proxyDecorate(inlineResult.url, 'inline') // ✅ Success!
  }
}
```

**Why it fails:**
- Article has no images
- Images are too small (< 800×450)
- Images are filtered out (logos, ads, tracking pixels)
- Website blocks scraping

---

### **Step 3: Try Tier 3 (Asset-Derived)**
```typescript
// For videos
if (type === 'video' && assetUrl) {
  const frameResult = await extractVideoFrame(assetUrl)
  if (frameResult) {
    return proxyDecorate(frameResult, 'video') // ✅ Success!
  }
}

// For PDFs
if (type === 'pdf' && assetUrl) {
  const pageResult = await renderPdfFirstPage(assetUrl)
  if (pageResult) {
    return proxyDecorate(pageResult, 'pdf') // ✅ Success!
  }
}

// For images
if (type === 'image' && assetUrl) {
  return proxyDecorate(assetUrl, 'image') // ✅ Success!
}
```

**Why it fails:**
- No `assetUrl` provided
- Video download timeout (> 30s)
- ffmpeg not available
- Video format not supported
- PDF rendering not implemented
- Image URL is broken

---

### **Step 4: Tier 4 - Generated Cover (ALWAYS SUCCEEDS)**
```typescript
// Last resort - generate a tasteful SVG cover
const domain = url ? new URL(url).hostname : 'carrot.app'
const generatedCover = await generateProgrammaticCover({
  domain,
  type: item.type,
  title: 'Content'
})

return proxyDecorate(generatedCover, 'generated') // ✅ Always succeeds!
```

**This creates:**
- Beautiful SVG gradient background
- Domain name in a chip at bottom
- Type icon (📄 article, 🎥 video, etc.)
- Subtle patterns and geometric elements
- **NO letter monograms**

**This CANNOT fail** because:
- SVG is generated in-memory (no network calls)
- Always returns valid data:image/svg+xml URL
- No external dependencies

---

## 🎨 **What Users See**

### **Scenario 1: Tier 1-3 Success (85-90%)**
```
┌─────────────────────────┐
│                         │
│   [Real Photo/Video]    │  ← OG image, video frame, etc.
│                         │
│   ┌─────────────────┐   │
│   │ Blur Placeholder│   │  ← Shows instantly
│   │ (8x8 blurred)   │   │
│   └─────────────────┘   │
│                         │
│   Title: "Article..."   │
│   Summary: "..."        │
│   [Open] [Attach]       │
└─────────────────────────┘
```

### **Scenario 2: Tier 4 Fallback (10-15%)**
```
┌─────────────────────────┐
│                         │
│   [Tasteful Gradient]   │  ← Purple/blue gradient
│   with subtle pattern   │  ← Dots, geometric shapes
│                         │
│   📄 Type Icon          │  ← Subtle, centered
│                         │
│   ┌──────────────┐      │
│   │ 🌐 domain.com│      │  ← Bottom left chip
│   └──────────────┘      │
│                         │
│   Title: "Article..."   │
│   Summary: "..."        │
│   [Open] [Attach]       │
└─────────────────────────┘
```

### **Scenario 3: Total Failure (Should be 0%)**
This should **NEVER** happen because Tier 4 always succeeds. But if it somehow does:

```typescript
// In enrichment API (route.ts)
catch (error) {
  console.error('[Enrich API] Hero resolution failed:', error)
  
  // Mark as failed in database
  await prisma.discoveredContent.update({
    where: { id },
    data: { status: 'failed' }
  })
}
```

Then in `DiscoveryCard.tsx`:
```typescript
{heroSrc ? (
  <img src={heroSrc} ... />  // Has a hero
) : (
  <GeneratedCover ... />      // No hero? Client-side fallback!
)}
```

So even if enrichment **completely fails**, the client still shows a `GeneratedCover` component. **Zero broken images!**

---

## 🚨 **Failure Scenarios & Recovery**

### **Network Timeouts**
```
Issue: Video download takes > 30s
Result: Tier 3 fails → Falls back to Tier 4
User sees: Generated cover (not broken)
Recovery: Increase timeout or add file size check
```

### **FFmpeg Not Available**
```
Issue: Server doesn't have ffmpeg installed
Result: Tier 3 video extraction skipped
User sees: Generated cover (not broken)
Recovery: Install ffmpeg on server
```

### **Rate Limiting**
```
Issue: Too many OG scrape requests
Result: Tier 1 fails → Try Tier 2-4
User sees: Inline image or generated cover
Recovery: Add rate limiting, caching
```

### **Invalid URLs**
```
Issue: URL is malformed or doesn't exist
Result: Tier 1-2 fail → Tier 4 generates cover
User sees: Generated cover with "carrot.app" domain
Recovery: None needed - graceful fallback
```

### **Memory Errors (Sharp)**
```
Issue: Processing huge image causes OOM
Result: Sharp fails → Skips blur/dominant
User sees: Hero without blur placeholder
Recovery: Add image size checks, memory limits
```

---

## 📈 **Improving Success Rates**

### **Reduce Tier 4 Usage (Optional)**

1. **Add more oEmbed providers**
   ```typescript
   // In getOEmbedImage.ts
   // Add: Instagram, TikTok, LinkedIn, Medium, etc.
   ```

2. **Improve inline image detection**
   ```typescript
   // In getFirstInlineImage.ts
   // Use ML to detect "hero" images
   // Check for largest image, high aspect ratio
   ```

3. **Add video thumbnail endpoints**
   ```typescript
   // Use Cloudflare Stream, Mux, or similar
   // Get professional thumbnails without ffmpeg
   ```

4. **Pre-fetch asset URLs**
   ```typescript
   // When discovering content, also save asset URLs
   // Improves Tier 3 success rate
   ```

---

## 🎯 **Success Metrics to Monitor**

### **Hero Resolution by Source**
```sql
SELECT 
  (media_assets->>'source') as source,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM discovered_content
WHERE media_assets IS NOT NULL
GROUP BY source
ORDER BY count DESC;
```

**Expected Output:**
```
source      | count | percentage
------------|-------|------------
og          |  650  |   65%
oembed      |  180  |   18%
inline      |   50  |    5%
video       |   20  |    2%
generated   |  100  |   10%      ← The "fail rate"
```

### **Failed Enrichments**
```sql
SELECT COUNT(*) as failed_count
FROM discovered_content
WHERE status = 'failed';
```

**Expected:** Should be 0 or very low (< 1%)

### **Processing Time by Tier**
```typescript
// Add timing logs in resolveHero.ts
console.log('[resolveHero] Tier 1 completed in', t1 - t0, 'ms')
console.log('[resolveHero] Tier 2 completed in', t2 - t1, 'ms')
console.log('[resolveHero] Tier 3 completed in', t3 - t2, 'ms')
console.log('[resolveHero] Tier 4 completed in', t4 - t3, 'ms')
```

---

## ✅ **The Bottom Line**

### **What "Fail Rate" Really Means**

❌ **NOT:** Broken images, error messages, blank cards  
✅ **YES:** Professional generated covers instead of real photos

### **Guarantees**

1. **100% of cards have a hero** (real or generated)
2. **0% show flat gradients**
3. **0% show letter monograms**
4. **0% show broken images**
5. **100% have blur placeholders** (when processing succeeds)
6. **100% have dominant colors** (when processing succeeds)

### **Actual Failure Modes**

The only TRUE failures are:
1. **Database errors** - Can't save enrichment result
2. **Catastrophic bugs** - Tier 4 generation crashes
3. **Out of memory** - Server runs out of resources

All of these are **extremely rare** and would affect the entire app, not just hero images.

---

## 🎨 **Design Philosophy**

> **"Graceful degradation with zero broken states"**

We prioritize:
1. **Real media first** (Tiers 1-3)
2. **Tasteful fallbacks** (Tier 4 generated covers)
3. **Zero broken UI** (always show something beautiful)
4. **Fast loading** (blur placeholders, instant fallbacks)

The "fail rate" is really a **"generated cover rate"** - and those covers look great! 🎨✨
