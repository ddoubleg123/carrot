# Wikimedia Fallback Implementation Audit

## Overview
Added Wikimedia Commons search as a fallback for hero image generation when AI servers are off or AI generation fails.

## Changes Made

### 1. Enrichment Worker (`carrot/src/lib/enrichment/worker.ts`)
- **Location**: Hero image fallback chain (after AI generation)
- **Flow**: 
  1. Try OpenGraph/Article images
  2. Try AI generation
  3. **NEW**: Try Wikimedia Commons search
  4. Fallback to favicon/placeholder

- **Search Logic**:
  - Extracts meaningful terms from article title
  - Filters out common words (< 3 chars, stop words)
  - Uses first 3 meaningful words for search
  - Falls back to first 50 chars of title if no meaningful terms

- **Error Handling**:
  - Wrapped in try-catch (non-blocking)
  - Logs errors but doesn't throw
  - Continues to next fallback if Wikimedia fails

### 2. Wikimedia Search API (`carrot/src/app/api/media/wikimedia-search/route.ts`)
- **Endpoint**: `POST /api/media/wikimedia-search`
- **Authentication**: Optional (supports `x-internal-key` header)
- **Functionality**:
  1. Searches Wikimedia Commons API for images
  2. Gets actual image URLs (not wiki page URLs) using `imageinfo` API
  3. Returns 800px thumbnails for performance
  4. Handles errors gracefully

- **Response Format**:
```json
{
  "images": [
    {
      "title": "Image title",
      "url": "https://upload.wikimedia.org/...",
      "thumbnail": "https://upload.wikimedia.org/...",
      "snippet": "Description..."
    }
  ]
}
```

### 3. Type Updates
- Added `'wikimedia'` to `imageSource` type union
- Updated type definitions in enrichment worker

## Testing

### Test Script
Created `carrot/scripts/test-wikimedia-fallback.ts` to verify:
- API endpoint accessibility
- Image URL format (direct URLs, not wiki pages)
- Search functionality with various queries
- Error handling

### Manual Testing Checklist
- [ ] Save new content with AI servers off
- [ ] Verify Wikimedia images appear in hero cards
- [ ] Check logs for Wikimedia search attempts
- [ ] Verify image URLs are direct (not wiki pages)
- [ ] Test with various article titles

## Edge Cases Handled

1. **Empty search results**: Falls back to next option
2. **API failures**: Logged but non-blocking
3. **Invalid image URLs**: Validates before using
4. **Timeout**: 10s timeout prevents hanging
5. **Missing thumbnail**: Falls back to constructed URL
6. **Empty title**: Uses first 50 chars as fallback

## Performance Considerations

- **Timeout**: 10 seconds for Wikimedia search
- **Image size**: Requests 800px thumbnails (not full resolution)
- **Parallel processing**: Uses `Promise.all` for multiple image info requests
- **Caching**: No caching implemented (could be added later)

## Security

- **Authentication**: Optional `x-internal-key` header support
- **Rate limiting**: None (relies on Wikimedia's rate limits)
- **Input validation**: Validates query parameter
- **Error messages**: Doesn't leak sensitive information

## Known Limitations

1. **Search quality**: Depends on Wikimedia Commons having relevant images
2. **Language**: Searches in English by default
3. **Image selection**: Always uses first result (could be improved)
4. **No caching**: Every request hits Wikimedia API

## Future Improvements

1. Add caching for search results
2. Improve search term extraction (use entity extraction)
3. Add image relevance scoring
4. Support multiple languages
5. Add retry logic for failed requests
6. Implement rate limiting

## Verification Status

✅ Code review complete
✅ Type definitions updated
✅ Error handling implemented
✅ Logging added
⏳ Manual testing pending
⏳ Production deployment pending

