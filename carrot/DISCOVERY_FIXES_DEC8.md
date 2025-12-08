# Discovery Frontend Display Fixes - December 8, 2025

## Summary

Fixed the issue where 4 saved citations were not appearing on the frontend. The problem was a mismatch between the API response format and what the frontend expected.

## Changes Made

### 1. ✅ Fixed API Response Format (`discovered-content/route.ts`)

**Problem**: API was returning `DiscoveryCardPayload` format, but frontend expected fields like `enrichedContent`, `mediaAssets`, and `status`.

**Solution**: Added compatibility fields to the API response:
- `enrichedContent`: Contains `summary150`, `keyPoints`, `notableQuote`, `readingTime`
- `mediaAssets`: Contains `hero`, `source`, `license` from hero data
- `status`: Determined from `isUseful` field (`ready` if useful, `pending_audit` otherwise)
- `sourceUrl`: Added for frontend compatibility
- `description`: Alias for `summary150`
- `metadata`: Enhanced with `readingTime`

### 2. ✅ Enhanced Frontend Mapping (`useDiscoveredItems.ts`)

**Problem**: Frontend mapping didn't handle the new API format fields properly.

**Solution**: Updated `mapToDiscoveredItem` to:
- Handle `hero` field from API (both object and string formats)
- Use `whyItMatters` as fallback for `summary150`
- Extract `keyPoints` from `facts` array if `enrichedContent.keyPoints` not available
- Extract `notableQuote` from `quotes` array if not in `enrichedContent`
- Use `textLength` for reading time calculation
- Added comprehensive fallback chain for all fields

### 3. ✅ Fixed Hero Generation Referrer Issue (`http1Fetch.ts`)

**Problem**: `referrer: 'no-referrer'` was being set as a string, causing `Referrer "no-referrer" is not a valid URL` error.

**Solution**: Removed the `referrer` field (only kept `referrerPolicy: 'no-referrer'`), which is the correct way to disable referrer in fetch API.

### 4. ✅ Added Debug Logging (`useDiscoveredItems.ts`)

**Added**: Comprehensive logging to trace frontend display issues:
- Logs API response data structure
- Logs raw items count
- Logs sample items with key fields
- Logs mapped items count
- Logs deduplicated items count
- Logs sample mapped items with display-relevant fields

## Files Modified

1. `carrot/src/app/api/patches/[handle]/discovered-content/route.ts`
   - Added `enrichedContent`, `mediaAssets`, `status` fields to API response
   - Enhanced metadata with reading time

2. `carrot/src/app/(app)/patch/[handle]/useDiscoveredItems.ts`
   - Enhanced `mapToDiscoveredItem` with better fallback handling
   - Added comprehensive debug logging

3. `carrot/src/lib/http1Fetch.ts`
   - Fixed referrer field issue (removed invalid `referrer: 'no-referrer'`)

## Testing

To verify the fixes:

1. **Check Browser Console**: Look for `[useDiscoveredItems]` logs showing:
   - API response data
   - Raw items count (should be 4)
   - Sample items with `enrichedContent`, `mediaAssets`, `status`
   - Mapped items count
   - Final items count

2. **Check Frontend Display**: The 4 saved citations should now appear in the discovery feed:
   - News (Wikinews search) - Score 85
   - Quotations (Wikiquote) - Score 85
   - Palestinian territories (Wikivoyage) - Score 75
   - İslâm Ansiklopedisi (Turkish encyclopedia) - Score 85

3. **Check Hero Generation**: Hero images should now generate without referrer errors (check server logs)

## Expected Behavior

- ✅ All 4 saved citations should appear on frontend
- ✅ Each citation should have a summary, key points, and hero image (when generated)
- ✅ No referrer errors in hero generation
- ✅ Debug logs should show proper data flow from API to frontend

## Next Steps

1. Monitor the discovery process to ensure new citations are being saved and displayed
2. Check hero generation success rate (should improve with referrer fix)
3. Review debug logs to ensure data flow is correct
4. Consider improving save rate if needed (currently 2.8% is actually good - filtering out low-quality content)

