# Citations Audit Test Page

## Overview

A comprehensive dashboard to view all citations, their processing status, relevance scores, extraction status, save status, and agent learning status.

## Access

**URL:** `/test/citations-audit/[handle]`

**Example:** `/test/citations-audit/israel`

## Features

### Summary Cards
- **Total Citations** - Total number of citations discovered
- **Saved** - Number of citations saved to DiscoveredContent
- **Extracted** - Number of citations with extracted text content
- **Agent Memories** - Number of citations that created AgentMemory entries

### Filters
- **All Citations** - Show all citations
- **Saved Only** - Show only citations that were saved
- **Extracted Only** - Show only citations with successful extraction
- **Errors Only** - Show citations with extraction errors
- **With Agent Memory** - Show citations that created agent memories

### Sort Options
- **Relevance Score** - Sort by AI priority score (highest first)
- **Created Date** - Sort by citation creation date
- **Last Scanned** - Sort by last scan time

### Citation Details Displayed

For each citation, the page shows:

1. **Citation Info**
   - Title
   - URL (clickable link)
   - Source number
   - Wikipedia page it came from

2. **Relevance**
   - AI Priority Score (0-100, color-coded)
   - Relevance Decision (saved/denied)
   - Scan Status
   - Verification Status

3. **Extraction**
   - Extraction Status (success/error/pending/not_saved)
   - Error message (if any)
   - Content length (if extracted)

4. **Saved**
   - Whether saved to DiscoveredContent
   - Text content length
   - Save date
   - Last crawled date

5. **Agent Learning**
   - Whether AgentMemory was created
   - Memory ID
   - Date learned

## API Endpoint

The page uses the API endpoint:
```
GET /api/patches/[handle]/citations-audit
```

Returns:
- Patch information
- Summary statistics
- Full list of citations with enrichment data

## Status Indicators

### Extraction Status Colors
- **success** (green) - Content successfully extracted
- **error** (red) - Extraction failed or error occurred
- **pending** (yellow) - Waiting to be processed
- **not_saved** (gray) - Not saved, so no extraction

### Relevance Score Colors
- **≥70** (green, bold) - High relevance
- **50-69** (yellow) - Medium relevance
- **<50** (red) - Low relevance
- **null** (gray) - No score yet

## Use Cases

1. **Debug extraction issues** - Filter by "Errors Only" to see failed extractions
2. **Check save rate** - Compare "Saved Only" filter count to total
3. **Verify agent learning** - Filter by "With Agent Memory" to see what agent learned
4. **Review relevance scores** - Sort by score to see highest/lowest relevance
5. **Monitor completion** - Use summary cards to track overall progress

