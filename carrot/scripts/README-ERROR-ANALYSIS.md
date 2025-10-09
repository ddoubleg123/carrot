# Error Log Analyzer

This script helps you analyze large error logs by grouping similar errors, counting occurrences, and providing actionable recommendations.

## Why Use This?

When you have thousands of error lines, it's impossible to paste them all into an AI chat. This script:
- ✅ Groups identical errors together
- ✅ Counts how many times each error occurs
- ✅ Shows only unique error patterns
- ✅ Provides actionable recommendations
- ✅ Reduces thousands of lines to a concise summary

## Usage

### Option 1: From a File

```bash
# Save your logs to a file first
node scripts/analyze-errors.js error-logs.txt
```

### Option 2: From Clipboard (Paste & Ctrl+D)

```bash
node scripts/analyze-errors.js
# Then paste your logs and press Ctrl+D (or Ctrl+Z on Windows) when done
```

### Option 3: From Browser Console

1. Open your browser DevTools Console
2. Right-click in the console → "Save as..."
3. Save as `console-logs.txt`
4. Run: `node scripts/analyze-errors.js console-logs.txt`

### Option 4: From Render Logs

1. Go to Render dashboard → Your service → Logs
2. Copy the logs (select all and copy)
3. Save to a file: `render-logs.txt`
4. Run: `node scripts/analyze-errors.js render-logs.txt`

## Example Output

```
================================================================================
ERROR LOG ANALYSIS REPORT
================================================================================

Total lines analyzed: 5,234
Error lines found: 847
Error rate: 16.18%

--------------------------------------------------------------------------------
ERROR SUMMARY BY CATEGORY
--------------------------------------------------------------------------------

[QUIC_PROTOCOL_ERROR] - 312 occurrences
--------------------------------------------------------------------------------
  ×   312 | net::ERR_QUIC_PROTOCOL_ERROR QUIC_IETF_GQUIC_ERROR_MISSING 206 (Partial Content)

[CONNECTION_CLOSED] - 156 occurrences
--------------------------------------------------------------------------------
  ×   156 | net::ERR_CONNECTION_CLOSED

[MEDIA_PRELOAD_FAILED] - 98 occurrences
--------------------------------------------------------------------------------
  ×    98 | [MediaPreloadQueue] Task failed url: '/api/img?url=data[BASE64]' error: 'Failed to fetch'

[VIDEO_LOADING_TIMEOUT] - 43 occurrences
--------------------------------------------------------------------------------
  ×    43 | [SimpleVideo] Loading timeout - forcing video to show duration: '[ID]ms'

================================================================================
TOP 5 MOST COMMON ERRORS (ALL CATEGORIES)
================================================================================

1. [QUIC_PROTOCOL_ERROR] × 312
   net::ERR_QUIC_PROTOCOL_ERROR QUIC_IETF_GQUIC_ERROR_MISSING 206 (Partial Content)
   Sample: GET https://firebasestorage.googleapis.com/v0/b/... net::ERR_QUIC_PROTOCOL_ERROR...

2. [CONNECTION_CLOSED] × 156
   net::ERR_CONNECTION_CLOSED
   Sample: GET /api/img?url=data%3Aimage%2Fpng%3Bbase64%2C... net::ERR_CONNECTION_CLOSED

================================================================================
RECOMMENDATIONS
================================================================================

• QUIC Protocol Errors (312): These are browser/network level issues. Consider checking if Firebase Storage URLs are being proxied unnecessarily.
• Connection Closed Errors (156): Check for double-encoding or slow proxy responses. Ensure direct Firebase URLs with tokens are used.
• Media Preload Failures (98): Review MediaPreloadQueue implementation and ensure URLs are valid before queuing.
• Video Loading Timeouts (43): Videos are taking too long to load. Check if proxying can be bypassed for signed URLs.
```

## What to Share with AI

Instead of pasting thousands of error lines, just share:
1. The **ERROR SUMMARY BY CATEGORY** section
2. The **TOP 5 MOST COMMON ERRORS** section
3. Any specific error patterns you're concerned about

This makes it much easier for the AI to understand and help fix the issues!

## Error Categories

The script automatically categorizes errors:

- **QUIC_PROTOCOL_ERROR** - Browser QUIC protocol issues
- **CONNECTION_CLOSED** - Network connection closed prematurely
- **MEDIA_PRELOAD_FAILED** - Media preload queue failures
- **VIDEO_LOADING_TIMEOUT** - Video taking too long to load
- **VIDEO_INVALID_FORMAT** - Invalid video format detected (validation working!)
- **IMAGE_LOAD_ERROR** - Image failed to load
- **IMAGE_PROXY_ERROR** - Image proxy issues
- **DATA_URI_BLOCKED** - Data URI correctly blocked by proxy
- **PROXY_ERROR** - General proxy errors
- **HTTP_400/499/500** - HTTP error codes
- **FIREBASE_ERROR** - Firebase-related errors
- **FAILED_TO_FETCH** - Generic fetch failures
- **UNCAUGHT_ERROR** - Uncaught exceptions
- **OTHER** - Everything else

## Tips

- Run this **after** making changes to see if error counts go down
- Compare reports before/after deployments
- Focus on the highest-count errors first
- Use the recommendations to guide your fixes

