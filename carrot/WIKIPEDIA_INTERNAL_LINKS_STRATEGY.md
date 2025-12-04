# Wikipedia Internal Links Processing Strategy

## Goal
- **Identify and store** Wikipedia internal links for later processing
- **Categorize** them for scanning if relevant
- **Do NOT block** external URL processing - external URLs are processed first, one by one

## Implementation

### 1. Extraction Phase
- `extractWikipediaCitationsWithContext` extracts ALL citations (external + Wikipedia internal)
- Citations are separated into:
  - **External citations**: URLs that are NOT Wikipedia/Wikimedia/Wikidata
  - **Wikipedia citations**: URLs that ARE Wikipedia/Wikimedia/Wikidata or relative paths (./, /wiki/)

### 2. Storage Phase
- **External URLs**: Stored with `verificationStatus: 'pending'` - these will be processed immediately
- **Wikipedia internal links**: Stored with `verificationStatus: 'pending_wiki'` - these are categorized for later processing

### 3. Processing Priority
- `getNextCitationToProcess` query:
  - Only selects citations with `verificationStatus: { in: ['pending', 'verified'] }`
  - Excludes `pending_wiki` (Wikipedia internal links)
  - Also excludes Wikipedia URLs by URL pattern (defensive check)
  - **Result**: External URLs are processed first, one by one

### 4. Wikipedia Internal Link Processing
- When a Wikipedia internal link is encountered (if it somehow gets through):
  - It's fetched and checked for relevance
  - If relevant (score >= 60), it's added to `wikipediaMonitoring` table
  - This allows Wikipedia-to-Wikipedia crawling
  - The citation is marked as processed (not saved as external citation)

### 5. Later Processing
- Wikipedia internal links marked as `pending_wiki` can be:
  - Processed when added to monitoring (if found to be relevant)
  - Processed in a separate Wikipedia-to-Wikipedia crawling phase
  - Used for analysis and categorization

## Benefits
1. ✅ External URLs are processed immediately (not blocked by Wikipedia links)
2. ✅ Wikipedia internal links are identified and stored for later
3. ✅ Relevant Wikipedia links are automatically added to monitoring
4. ✅ System continues processing external URLs one by one

## Database Status
- **External URLs**: `verificationStatus: 'pending'` or `'verified'` → Processed immediately
- **Wikipedia internal links**: `verificationStatus: 'pending_wiki'` → Categorized for later
- **Processed Wikipedia links**: Added to `wikipediaMonitoring` if relevant

