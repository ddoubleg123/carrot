# Discovery Completion Tracking System

## Overview

This system tracks discovery completion status to know when all relevant citations have been processed, saved, and extracted.

## Completion Criteria

Discovery is **100% complete** when:

1. ✅ **All citations scanned** - Every citation has `scanStatus: 'scanned'`
2. ✅ **All relevant citations saved** - Every relevant citation has `relevanceDecision: 'saved'` and `savedContentId` set
3. ✅ **All saved citations extracted** - Every saved citation's `DiscoveredContent` has `textContent` populated

## Tracking Fields

### WikipediaCitation Table
- `scanStatus`: 'not_scanned' | 'scanning' | 'scanned'
- `relevanceDecision`: 'saved' | 'denied' | null
- `aiPriorityScore`: Float (0-100) - relevance score
- `savedContentId`: FK to DiscoveredContent (if saved)
- `savedMemoryId`: FK to AgentMemory (if saved as memory)

### DiscoveredContent Table
- `textContent`: The extracted text content
- `contentHash`: Hash to detect changes
- `lastCrawledAt`: When content was extracted

## Completion Formula

```typescript
Overall Completion = (
  Citations Processed % × 0.3 +      // 30% weight - process all citations
  Relevant Saved % × 0.4 +            // 40% weight - save all relevant
  Relevant Extracted % × 0.3          // 30% weight - extract all saved
)

Relevant Citations = Citations with:
  - relevanceDecision === 'saved', OR
  - aiPriorityScore >= 50

Citations Processed = (scanned / total) × 100
Relevant Saved = (saved / relevant) × 100
Relevant Extracted = (extracted / saved) × 100
```

## Audit Script

Run the completion audit:
```bash
npx tsx scripts/audit-discovery-completion.ts
```

Outputs:
- Citation statistics (total, scanned, saved, denied)
- Relevance score distribution
- Saved content status
- Extraction status
- Completion percentages
- Remaining work

## Identifying Completion

### Check Completion Status

The audit script provides:
- `completion.isComplete`: Boolean - true when 100% complete
- `completion.overallCompletion`: Number (0-100) - overall progress
- `remaining`: Object with counts of remaining work

### Completion States

1. **In Progress** (< 100%)
   - Citations still being scanned
   - Relevant citations not yet saved
   - Saved content not yet extracted

2. **Complete** (100%)
   - All citations scanned
   - All relevant citations saved
   - All saved citations extracted

## Integration with Discovery Engine

The discovery engine should:

1. **Check completion periodically** - Run audit to check status
2. **Stop when complete** - Exit gracefully when 100% complete
3. **Report progress** - Log completion percentages
4. **Resume if incomplete** - Continue processing remaining items

### Example Integration

```typescript
// In discovery engine loop
const audit = await auditCompletion(patchId)
if (audit.completion.isComplete) {
  console.log('✅ Discovery complete - all relevant citations processed')
  this.stopRequested = true
  return
}

console.log(`📊 Progress: ${audit.completion.overallCompletion.toFixed(1)}%`)
console.log(`   Remaining: ${audit.remaining.citationsToScan} citations, ${audit.remaining.relevantToSave} to save`)
```

## Adding New Sources

When adding new sources (not citations):

1. Add to `DiscoveredContent` directly (not via citations)
2. Track in separate tables/categories
3. Include in completion audit separately
4. Process independently from citation pipeline

## Monitoring

- **Daily audits** - Check completion status
- **Progress tracking** - Monitor completion percentage over time
- **Alert on completion** - Notify when 100% complete
- **Alert on stuck** - Notify if completion doesn't increase

