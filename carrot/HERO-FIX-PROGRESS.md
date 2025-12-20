# Hero Title & Image Fix - Progress Report

## Issues Identified

1. **Titles not updating on frontend** - Poor titles like "10.1017/chol9780521772488.005", "book part", "Untitled" still showing
2. **Images not loading** - CSP errors and network failures preventing hero images from displaying

## Fixes Applied

### ✅ Completed

1. **CSP Updated** - Added `via.placeholder.com` and `*.google.com` to `img-src` directive
2. **Referrer Policy Fixed** - Removed `referrerPolicy` from fetch options to avoid validation errors
3. **API Improved** - Now skips favicon URLs and handles ERROR status heroes better
4. **Title Extraction Enhanced** - Improved logic in `wikipediaProcessor.ts` to avoid poor titles

### ⚠️ Remaining Issues

1. **Network Failures** - Many URLs are timing out or failing to fetch (40+ second timeouts)
   - This is causing hero enrichment to fail
   - Need to investigate network connectivity or increase timeouts

2. **Poor Titles Without Better Sources** - 24 items have poor titles but no better source available:
   - DOIs like "10.1017/chol9780521772488.005" - no better title in Hero, Citation, or URL
   - Generic terms like "book part", "Untitled" - no better source found
   - These may need manual review or AI-generated titles

3. **Hero Images Still Failing** - Even with CSP fixes, images aren't loading:
   - Some heroes have favicon URLs which are filtered out
   - Network failures preventing proper image extraction
   - Need to retry after referrer fix is deployed

## Next Steps

1. **After Deployment:**
   - Retry failed heroes: `npx tsx scripts/retry-failed-heroes.ts`
   - Generate missing heroes: `npx tsx scripts/generate-missing-heroes.ts`
   - Check if referrer fix resolves the errors

2. **For Titles That Can't Be Fixed:**
   - Consider using AI to generate better titles from content
   - Or accept that some titles will be poor until content is re-processed

3. **For Network Issues:**
   - Investigate why so many URLs are timing out
   - May need to increase timeout values
   - Or use a different fetching strategy for problematic domains

## Testing

After deployment, verify:
- [ ] Images load without CSP errors
- [ ] Titles update when database is updated
- [ ] Hero enrichment succeeds with referrer fix
- [ ] Frontend shows correct titles and images

