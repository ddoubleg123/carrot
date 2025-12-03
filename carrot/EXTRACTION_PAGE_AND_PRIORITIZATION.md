# Extraction Page & Prioritization Documentation

## Extraction Page Features

### Table Format
The extraction page (`/test/extraction`) now displays all citations in a clean, filterable table format with the following columns:

1. **URL**: The citation URL (Wikipedia internal or external)
   - Wikipedia internal links are marked with a "WIKI" badge
   - Clickable links that open in new tab
   - Truncated for display (full URL shown in expanded view)

2. **Reference Wikipedia Page**: The Wikipedia page that references this URL
   - Clickable link to the source Wikipedia page
   - Shows which page the citation came from

3. **Ref #**: Reference number on the Wikipedia page

4. **Scan Status**: Current scanning status
   - `scanned`: Content has been fetched and processed
   - `not_scanned`: Not yet processed
   - `scanning`: Currently being processed

5. **Verification Status**: URL verification status
   - `verified`: URL is valid and accessible
   - `failed`: URL verification failed (may still be processable)
   - `pending`: Not yet verified

6. **Decision**: Relevance decision
   - `saved`: Content was saved to DiscoveredContent
   - `denied`: Content was rejected (not relevant or low quality)
   - `Pending`: No decision yet

7. **AI Score**: Relevance score from AI (0-100)
   - Green (≥60): High relevance
   - Yellow (40-59): Medium relevance
   - Red (<40): Low relevance

8. **Data Extracted**: Amount of content extracted
   - Shows character count
   - Clickable button to view full content
   - "No data" if no content extracted

9. **Actions**: Manual verification button
   - Triggers content extraction and AI scoring
   - Useful for reprocessing failed or pending citations

### Filtering Capabilities

The page includes comprehensive filtering:

- **Search**: Search across URLs, titles, context, and Wikipedia page names
- **URL Type**: Filter by:
  - All URLs
  - External URLs only
  - Wikipedia internal links only
- **Scan Status**: Filter by scanning status
- **Verification Status**: Filter by verification status
- **Relevance Decision**: Filter by decision (including "No Decision")

### Sorting

All columns are sortable by clicking the column header:
- URL (alphabetical)
- Reference Wikipedia Page (alphabetical)
- Scan Status
- Verification Status
- Decision
- AI Score (numerical)
- Data Extracted (numerical)
- Created At (chronological)

### Expanded View

Clicking any row expands it to show:
- Full URL
- Title
- Context
- Full extracted content (if available)
- Error messages (if any)
- Metadata (created date, last scanned, saved IDs)

## Wikipedia Internal Links Processing

### Flow

1. **Extraction**: When citations are extracted from Wikipedia pages, relative links (e.g., `./National_Library_of_Israel`) are identified.

2. **Conversion**: Relative links are converted to absolute Wikipedia URLs:
   - `./PageName` → `https://en.wikipedia.org/wiki/PageName`
   - `/wiki/PageName` → `https://en.wikipedia.org/wiki/PageName`

3. **Relevance Check**: The system fetches the Wikipedia page and checks relevance using DeepSeek AI:
   - Extracts basic text content
   - Scores relevance to the topic (0-100)
   - Determines if the page is relevant (score ≥ 60)

4. **Action Based on Relevance**:
   - **If Relevant (score ≥ 60)**:
     - Added to `wikipediaMonitoring` table for Wikipedia-to-Wikipedia crawling
     - Citations from that page are immediately extracted and stored
     - Original citation is marked as `scanned` with `relevanceDecision: 'denied'` (not saved as external citation)
     - Error message: "Wikipedia internal link - added to monitoring for crawling"
   
   - **If Not Relevant (score < 60)**:
     - Marked as `scanned` with `relevanceDecision: 'denied'`
     - Error message: "Wikipedia internal link - not relevant (score: X)"

5. **Citation Extraction**: When a relevant Wikipedia page is added to monitoring:
   - Page HTML is fetched
   - All citations (references, external links, further reading) are extracted
   - Citations are stored in `wikipediaCitation` table
   - Citations are prioritized using AI scoring
   - Citations are processed incrementally by the discovery engine

### Key Functions

- `addWikipediaPageToMonitoring()`: Adds relevant Wikipedia pages to monitoring
- `extractAndStoreCitations()`: Extracts and stores all citations from a Wikipedia page
- `processCitation()`: Processes individual citations (external or Wikipedia internal)

## Prioritization Logic

### Citation Processing Priority

Citations are prioritized using the following criteria (in `getNextCitationToProcess`):

1. **AI Priority Score** (descending): Citations with higher AI scores are processed first
2. **Creation Date** (ascending): Older citations are processed first (FIFO)

### Query Conditions

A citation is eligible for processing if:
- `verificationStatus`: `'pending'`, `'verified'`, or `'failed'` (includes failed URLs that may still be processable)
- `scanStatus`: `'not_scanned'` or `'scanning'` (not yet processed)
- `relevanceDecision`: `null` (no decision made yet)

### AI Scoring

Citations are scored using DeepSeek AI based on:
1. Relevance to the core topic
2. Importance/authority of the source
3. Likelihood of containing valuable, factual information
4. Recency (if date is mentioned)

### Content Extraction Priority

When extracting content from citations:

1. **Phase 1: Quick Validation**
   - Minimum content length: 500 characters
   - Must be an actual article (not metadata/catalog page)
   - Must have at least 3 paragraphs

2. **Phase 2: AI Scoring** (if Phase 1 passes)
   - Content is sent to DeepSeek for relevance scoring
   - Score must be ≥ 60 to be considered relevant
   - Additional checks for article quality

3. **Phase 3: Saving** (if score ≥ 60)
   - Content is saved to `DiscoveredContent`
   - Hero image is generated
   - Content is enriched with metadata

### Processing Order

1. **High Priority**: Citations with `aiPriorityScore` ≥ 70
2. **Medium Priority**: Citations with `aiPriorityScore` 40-69
3. **Low Priority**: Citations with `aiPriorityScore` < 40 or null

### Batch Processing

- Citations are processed incrementally (50 per run)
- Processing is throttled to avoid overwhelming the system
- Failed citations can be reprocessed manually via the verification button

## Manual Verification

### Endpoint

`POST /api/test/extraction/verify`
Body: `{ citationId: string }`

### Functionality

1. Verifies citation exists
2. Calls `reprocessCitation()` to:
   - Fetch content from URL
   - Extract text using 3-stage extraction chain (Readability → ContentExtractor → fallback)
   - Score relevance using DeepSeek AI
   - Save to `DiscoveredContent` if relevant (score ≥ 60)
3. Returns updated citation status

### Use Cases

- Reprocess failed citations
- Manually trigger processing for pending citations
- Test content extraction for specific URLs
- Verify AI scoring accuracy

## Statistics Dashboard

The page displays key statistics:
- **Total Citations**: All citations (external + Wikipedia internal)
- **External URLs**: Non-Wikipedia citations
- **Wikipedia Internal**: Wikipedia page links
- **Scanned**: Citations that have been processed
- **With Content**: Citations with extracted content
- **Saved**: Citations saved to DiscoveredContent

## Next Steps

1. **Verify Wikipedia Internal Link Processing**:
   - Test that relevant Wikipedia pages are being added to monitoring
   - Verify citations are being extracted from newly added pages
   - Check that Wikipedia-to-Wikipedia crawling is working

2. **Assess Prioritization**:
   - Review AI scoring accuracy
   - Adjust thresholds if needed
   - Monitor processing order and efficiency

3. **Content Extraction Verification**:
   - Test extraction quality for various URL types
   - Verify 3-stage extraction chain is working
   - Check that content length and quality meet requirements

4. **Performance Optimization**:
   - Monitor processing speed
   - Optimize batch sizes
   - Improve error handling and retry logic

