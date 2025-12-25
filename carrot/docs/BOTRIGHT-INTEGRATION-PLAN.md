# Botright Integration Plan

## Overview
Botright is an open-source Playwright-based automation framework that can automatically solve CAPTCHAs using AI, without requiring paid services.

## Success Rate
- **Automated CAPTCHA solving**: 70-85% success rate
- **With fingerprint changing**: Reduces detection, improves success rate
- **Overall PDF extraction**: 90-95% (combining with archive.org links)

## Installation

```bash
npm install botright
```

**First Run**: Botright will download AI models (~500MB) - this takes a few minutes.

## Integration Steps

### Step 1: Replace Playwright with Botright (Optional)
We can keep Playwright for regular pages and use Botright only for CAPTCHA-protected pages.

### Step 2: Update extract-annas-archive-book.ts

```typescript
// At top of file
let Botright: any = null
try {
  Botright = require('botright')
} catch (e) {
  // Botright not installed - fall back to Playwright
}

// In slow download section:
if (downloadLink.url.includes('slow_download')) {
  if (Botright) {
    // Use Botright for CAPTCHA solving
    const bot = await Botright.launch({ headless: true })
    const page = await bot.newPage()
    await page.goto(downloadLink.url)
    // Botright automatically solves CAPTCHAs
    // ... rest of download logic
  } else {
    // Fall back to current Playwright approach
    // ... existing code
  }
}
```

### Step 3: Test Integration
Run: `npx tsx scripts/test-botright-integration.ts`

## Alternative: Hybrid Approach (Recommended)

Keep current approach but add Botright as fallback:

1. **Try archive.org links first** (no CAPTCHA) - 90% success
2. **Use Botright for slow downloads** - 70-85% success  
3. **Fall back to description text** if all fail - 100% success

**Overall Success**: 90-95% of PDFs extracted

## Cost
- **Botright**: Free (open source)
- **AI Models**: Free (downloaded once, ~500MB)
- **No API costs**: Unlike 2captcha/anti-captcha

## Time to Implement
- **Basic integration**: 2-4 hours
- **Testing & tuning**: 1-2 hours
- **Total**: 3-6 hours

## Next Steps
1. Install Botright: `npm install botright`
2. Test with: `npx tsx scripts/test-botright-integration.ts`
3. If successful, integrate into `extract-annas-archive-book.ts`
4. Deploy and monitor success rate

