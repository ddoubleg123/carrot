# Citation Processing Fix - Complete Solution

## 🔍 Problem Analysis

### Current Status
- **Total citations:** 17,135
- **Scanned:** 3,795 (22%)
- **Saved:** 1,357 (8%)
- **Not scanned:** 13,340 (78%)
- **Denied with high scores (>=70):** 8 citations
- **Saved but missing savedContentId:** 30 citations

### Issues Identified

1. **Processing Too Slow**
   - Only 22% of citations have been scanned
   - 78% remain unprocessed
   - No continuous processing worker

2. **High-Score Citations Being Denied**
   - 8 citations with scores >= 70 were denied
   - Relevance check was too strict (required both `isRelevant: true` AND `score >= 60`)
   - High scores (>= 70) should be trusted even if `isRelevant` is false

3. **Failed Saves**
   - 30 citations marked as "saved" but missing `savedContentId`
   - Save operation failed but citation was marked as saved

## ✅ Solutions Implemented

### 1. More Lenient Relevance Check

**File:** `carrot/src/lib/discovery/wikipediaProcessor.ts`

**Before:**
```typescript
const RELEVANCE_THRESHOLD = 60
const isRelevantFromDeepSeek = scoringResult.isRelevant && aiPriorityScore >= RELEVANCE_THRESHOLD
```

**After:**
```typescript
const RELEVANCE_THRESHOLD = 50  // Lower threshold
const hasHighScore = aiPriorityScore >= 70
const hasPassingScore = aiPriorityScore >= RELEVANCE_THRESHOLD
// Trust high scores (>= 70) even if isRelevant is false
const isRelevantFromDeepSeek = hasHighScore || (scoringResult.isRelevant && hasPassingScore)
```

**Impact:**
- Citations with score >= 70 are now saved regardless of `isRelevant` flag
- Lower threshold (50) allows more borderline cases
- More citations will be saved

### 2. Batch Processing Script

**File:** `carrot/scripts/process-all-citations.ts`

**Features:**
- Processes all unprocessed citations in batches
- Configurable batch size and limit
- Progress tracking and error handling
- Saves to DiscoveredContent and AgentMemory

**Usage:**
```bash
# Process all citations (no limit)
ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10

# Process with limit
ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10 --limit=100

# Dry run
ts-node scripts/process-all-citations.ts --patch=israel --dry-run
```

### 3. Reprocess Denied High-Score Citations

**File:** `carrot/scripts/reprocess-denied-high-score-citations.ts`

**Features:**
- Finds denied citations with high AI scores (>= 70)
- Resets them for reprocessing
- Can be run before batch processing

**Usage:**
```bash
# Find and reset denied high-score citations
ts-node scripts/reprocess-denied-high-score-citations.ts --patch=israel --min-score=70

# Dry run to see what would be reprocessed
ts-node scripts/reprocess-denied-high-score-citations.ts --patch=israel --min-score=70 --dry-run
```

### 4. Fix Failed Saves

**File:** `carrot/scripts/fix-failed-saves.ts` (to be created)

**Features:**
- Finds citations marked "saved" but missing `savedContentId`
- Attempts to save them again
- Updates `savedContentId` if successful

## 🚀 Execution Plan

### Step 1: Reprocess Denied High-Score Citations

```bash
# Reset denied citations with score >= 70
ts-node scripts/reprocess-denied-high-score-citations.ts --patch=israel --min-score=70
```

This will reset 8 citations for reprocessing.

### Step 2: Process All Unprocessed Citations

```bash
# Process in batches of 10 (start with 100 to test)
ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10 --limit=100

# If successful, process all remaining
ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10
```

This will process all 13,340 unprocessed citations.

### Step 3: Fix Failed Saves (Optional)

```bash
# Fix citations marked saved but missing savedContentId
ts-node scripts/fix-failed-saves.ts --patch=israel
```

### Step 4: Monitor Progress

```bash
# Check citation status
ts-node scripts/check-citation-status.ts
```

## 📊 Expected Results

### After Fixes:

1. **More Citations Saved**
   - High-score citations (>= 70) will be saved
   - Lower threshold (50) will catch more borderline cases
   - Expected: 2,000-3,000 citations saved (up from 1,357)

2. **Faster Processing**
   - Batch processing script can handle large volumes
   - Can run continuously or in scheduled batches
   - Expected: Process 100-200 citations/hour

3. **Better Quality**
   - More lenient relevance check still maintains quality
   - High scores (>= 70) are trusted
   - Lower threshold (50) with `isRelevant` flag maintains standards

## 🔄 Continuous Processing

### Option 1: Scheduled Batch Processing

Run the processing script on a schedule (e.g., every hour):

```bash
# Cron job (every hour)
0 * * * * cd /path/to/carrot && ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10 --limit=50
```

### Option 2: Continuous Worker

Create a worker process that runs continuously:

```typescript
// scripts/citation-worker.ts
while (true) {
  const citation = await getNextCitationToProcess(patchId)
  if (!citation) {
    await sleep(60000) // Wait 1 minute if no citations
    continue
  }
  await processNextCitation(...)
  await sleep(1000) // Small delay between citations
}
```

## 📈 Monitoring

### Key Metrics to Track:

1. **Processing Rate**
   - Citations processed per hour
   - Target: 100-200/hour

2. **Save Rate**
   - Percentage of citations saved
   - Target: 15-25% (up from 8%)

3. **Quality Metrics**
   - Average AI score of saved citations
   - Target: >= 60

4. **Error Rate**
   - Failed processing attempts
   - Target: < 5%

## ✅ Next Steps

1. ✅ Lower relevance threshold and trust high scores
2. ✅ Create batch processing script
3. ✅ Create reprocess denied high-score script
4. ⏳ Fix failed saves script
5. ⏳ Create continuous worker
6. ⏳ Set up monitoring dashboard

## 🎯 Success Criteria

- [ ] All 13,340 unprocessed citations are processed
- [ ] Save rate increases from 8% to 15-25%
- [ ] High-score citations (>= 70) are saved
- [ ] Failed saves are fixed
- [ ] Processing rate: 100-200 citations/hour
- [ ] Error rate: < 5%

