# Patch Articles Display Fix

## Problem
Frontend showed 0 articles on patch pages (`/patch/[handle]`) even though backend logs showed "Saved article..." messages. Articles were being persisted to the database but not displayed.

## Root Cause
The API endpoint `/api/patches/[handle]/discovered-content` had a **verification gate** (lines 164-193) that checked each article's source URL via `/api/internal/links/verify`. This verification was:
1. Too strict - filtering out all items if verification failed
2. Slow - blocking the response with sequential verification calls
3. Error-prone - any timeout or error would remove items from the response

## Solution

### 1. Disabled Verification Gate (Default)
- Set `SKIP_LINK_VERIFICATION=true` by default
- Verification can be re-enabled via environment variable if needed
- Added timeout handling (2s) for when verification is enabled
- Added detailed logging of verification results

### 2. Added Comprehensive Debug Logging
**API Endpoint (`/api/patches/[handle]/discovered-content`):**
- Logs database query results (count, sample IDs)
- Logs before/after verification counts
- Logs verification skip reasons
- Returns debug info in response when `?debug=1`

**Frontend Hook (`useDiscoveryStream`):**
- Logs fetch URL and response status
- Logs response data structure
- Logs item counts at each stage
- Warns when payload is empty with debug info

**Component (`DiscoveryList`):**
- Logs item processing (raw → deduped → visible)
- Shows debug panel with counts when `?debug=1`

### 3. Added Debug Panel
When `?debug=1` is in the URL, shows:
- Patch handle
- Raw items count (from API)
- Deduped count (after deduplication)
- Visible count (currently rendered)
- Total saved/skipped/duplicates from discovery state
- Health endpoint data (DB count, sample items)

### 4. Added Health Endpoint
**`GET /api/patches/[handle]/discovered-content/health`**
- Returns total count from database
- Returns sample items with metadata
- Useful for diagnostics without loading full payload

### 5. Added Playwright Test
**`tests/patch-articles-display.spec.ts`**
- Verifies API endpoint returns data
- Verifies at least one article card renders
- Verifies debug panel shows non-zero counts
- Verifies health endpoint works

## Files Modified

1. **`src/app/api/patches/[handle]/discovered-content/route.ts`**
   - Disabled verification gate by default
   - Added debug logging throughout
   - Added debug query param support
   - Improved error handling

2. **`src/app/(app)/patch/[handle]/hooks/useDiscoveryStream.ts`**
   - Added comprehensive logging
   - Improved error messages
   - Added cache-busting headers

3. **`src/app/(app)/patch/[handle]/components/DiscoveryList.tsx`**
   - Added debug panel with `?debug=1`
   - Added health endpoint integration
   - Added debug logging

4. **`src/app/api/patches/[handle]/discovered-content/health/route.ts`** (NEW)
   - Health check endpoint
   - Returns count and sample items

5. **`tests/patch-articles-display.spec.ts`** (NEW)
   - Playwright test for article display
   - Verifies API, rendering, and debug panel

## Testing

### Manual Testing
1. Navigate to `/patch/chicago-bulls?debug=1`
2. Check browser console for debug logs
3. Verify debug panel shows non-zero counts if articles exist
4. Verify article cards render

### API Testing
```bash
# Test API endpoint
curl "https://your-domain.com/api/patches/chicago-bulls/discovered-content?limit=50&debug=1"

# Test health endpoint
curl "https://your-domain.com/api/patches/chicago-bulls/discovered-content/health"
```

### Playwright Testing
```bash
cd carrot
npx playwright test tests/patch-articles-display.spec.ts
```

## Environment Variables

- `SKIP_LINK_VERIFICATION` - Set to `'true'` to skip verification (default: true)
- `TEST_PATCH_HANDLE` - Patch handle for Playwright tests (default: `'chicago-bulls'`)
- `NEXT_PUBLIC_BASE_URL` - Base URL for Playwright tests (default: `'http://localhost:3000'`)

## Acceptance Criteria ✅

- ✅ With `?debug=1`, page shows active filters and non-zero count (if articles exist)
- ✅ At least one article card renders without manual interaction (if articles exist)
- ✅ Network tab shows 200 with non-empty array from same params page uses
- ✅ Health endpoint returns count matching database
- ✅ Playwright test passes

## Next Steps

1. **Monitor Production Logs**
   - Check for "Discovered Content" logs in Render
   - Verify articles are being returned
   - Check verification skip reasons if re-enabled

2. **Re-enable Verification (Optional)**
   - Set `SKIP_LINK_VERIFICATION=false` in production
   - Monitor verification failure rates
   - Adjust timeout/thresholds if needed

3. **Optimize Verification (Future)**
   - Make verification async/non-blocking
   - Cache verification results
   - Batch verification requests

## Commit
`4a7f21ac` - fix(patch): show saved articles; align filters/schema; add debug

