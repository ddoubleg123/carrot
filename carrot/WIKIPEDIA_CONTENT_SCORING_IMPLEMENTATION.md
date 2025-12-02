# Wikipedia Content Scoring Implementation

## Overview
This document describes the implementation of content-based scoring for Wikipedia citations, replacing the previous metadata-only prioritization approach.

## Changes Made

### 1. Database Schema Update
- **Added `contentText` field** to `WikipediaCitation` table
  - Type: `TEXT` (nullable)
  - Stores extracted article content after fetch
  - Used for audit/debugging and future reference

### 2. Phase 1: Citation Extraction (No Scoring)
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`

- **Removed early DeepSeek prioritization** from `processNextWikipediaPage()`
- Citations are now stored **without `aiPriorityScore`** initially (set to `null`)
- All citations are stored regardless of potential relevance
- Status: `verificationStatus: 'pending'`, `scanStatus: 'not_scanned'`

### 3. Phase 2: Content Fetching and Scoring
**File**: `carrot/src/lib/discovery/wikipediaProcessor.ts`

#### New Function: `scoreCitationContent()`
- Fetches actual article content
- Calls DeepSeek API with **full article text** (not just metadata)
- Prompt: "Analyze this article for relevance to {topic}"
- Returns: `{ score: 0-100, isRelevant: boolean, reason: string }`

#### Updated Function: `processNextCitation()`
1. **Fetch content** from citation URL
2. **Extract text** from HTML (remove scripts, styles, tags)
3. **Validate content**:
   - Minimum length: 500 characters
   - Must not be just whitespace
   - Reject if insufficient content
4. **Score with DeepSeek**:
   - Pass actual article content to DeepSeek
   - Get relevance score (0-100) based on full content
   - Store score in `aiPriorityScore`
5. **Store content** in `WikipediaCitation.contentText`
6. **Relevance decision**:
   - Primary: DeepSeek score >= 60 AND `isRelevant === true`
   - Secondary (optional): RelevanceEngine validation
   - Only save to DiscoveredContent if DeepSeek approves

### 4. Content Storage
**File**: `carrot/src/lib/discovery/wikipediaCitation.ts`

- Updated `markCitationScanned()` to accept:
  - `contentText`: Extracted article content
  - `aiPriorityScore`: DeepSeek score from actual content
- Content is stored even if citation is rejected (for audit/debugging)

### 5. Content Validation
- Minimum content length: 500 characters
- Content must be meaningful (not just whitespace)
- Citations with insufficient content are rejected early
- Content is still stored in database for audit purposes

## Flow Diagram

```
Phase 1: Citation Extraction
├── Identify Wikipedia page
├── Extract all citations (title, URL, context)
├── Store in database with aiPriorityScore: null
└── Mark as verificationStatus: 'pending', scanStatus: 'not_scanned'

Phase 2: Content Processing (per citation)
├── Fetch citation URL
├── Extract text content from HTML
├── Validate content (>= 500 chars, meaningful)
│   └── If invalid → Reject, store content, mark as 'denied'
├── Call DeepSeek with actual content
│   ├── Prompt: "Analyze this article for relevance to {topic}"
│   └── Get: { score: 0-100, isRelevant: boolean, reason: string }
├── Store content in WikipediaCitation.contentText
├── Store score in WikipediaCitation.aiPriorityScore
├── Check relevance:
│   ├── Primary: DeepSeek score >= 60 AND isRelevant === true
│   └── Secondary: RelevanceEngine validation (optional)
└── Save to DiscoveredContent only if DeepSeek approves
```

## Key Improvements

1. **Accurate Scoring**: DeepSeek now scores based on actual article content, not just metadata
2. **Content Storage**: All extracted content is stored for audit/debugging
3. **Better Validation**: Content must be meaningful (>500 chars) before scoring
4. **Clear Separation**: Phase 1 (extraction) vs Phase 2 (scoring) are clearly separated
5. **Audit Trail**: Even rejected citations have their content stored

## Migration Required

Run the migration script to add the `content_text` column:

```bash
npx tsx scripts/add-content-text-column.ts
```

## Testing

After migration, test the flow:
1. Create a new patch or use existing patch
2. Run discovery to trigger Wikipedia processing
3. Check that citations are stored without scores initially
4. Verify that content is fetched and scored in Phase 2
5. Confirm that `contentText` and `aiPriorityScore` are populated in database
6. Verify that only relevant citations (score >= 60) are saved to DiscoveredContent

## Rollback

If needed, the `content_text` column can be dropped:

```sql
ALTER TABLE "wikipedia_citations" DROP COLUMN IF EXISTS "content_text";
```

The system will continue to work without this column, but content won't be stored for audit purposes.

