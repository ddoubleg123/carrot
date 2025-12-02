# Wikipedia Discovery System Analysis

## Issues Identified

### 1. ❌ Relevance Scoring is Broken

**Problem**: Citations are being saved without proper relevance verification to the core topic (Chicago Bulls).

**Current Implementation**:
- `prioritizeCitations()` uses AI to score citations 0-100 based on relevance
- BUT: The score is stored in `aiPriorityScore` and **not used** for saving decisions
- `processNextCitation()` uses a simple heuristic: `isRelevant = textContent.length > 500`
- This means "Canadian Premier League" (unrelated) gets saved if it has >500 chars

**Location**: `carrot/src/lib/discovery/wikipediaProcessor.ts:465`

**Impact**: 
- 579 citations saved, but many are unrelated (Canadian Premier League, Canadian Football League, etc.)
- No actual topic verification happening
- `isUseful` flag also uses length check instead of relevance

### 2. ❌ Hero Images Not Generated

**Problem**: No hero images showing for Wikipedia citations.

**Current Implementation**:
- When saving citations, `hero: Prisma.JsonNull` is set (line 614 in engineV21.ts)
- Hero pipeline is not triggered for Wikipedia citations
- No automatic enrichment happening

**Location**: `carrot/src/lib/discovery/engineV21.ts:614`

**Impact**:
- All Wikipedia citation cards show placeholder/no image
- Poor user experience

### 3. ⚠️ Relevance Engine Not Used

**Problem**: There's a `RelevanceEngine` class that can check if content is relevant to Chicago Bulls, but it's not being used for Wikipedia citations.

**Available Tools**:
- `carrot/src/lib/discovery/relevance.ts` - Has `checkRelevance()` method
- `carrot/src/lib/discovery/groupProfiles.ts` - Has Chicago Bulls profile with entities, keywords, people
- These are used for regular discovery but NOT for Wikipedia citations

**Impact**: Wikipedia citations bypass all relevance checks

## What's Working ✅

1. **KPIs Display**: New Wikipedia-specific KPIs are showing correctly
2. **Citation Extraction**: 4,839 citations extracted from 20 Wikipedia pages
3. **Citation Processing**: 1,904 citations processed, 579 saved to DiscoveredContent
4. **Agent Memory**: 1,848 memories created (though many may be irrelevant)
5. **Database Storage**: All citations properly stored with tracking
6. **Incremental Processing**: System resumes from where it left off

## Recommended Fixes

### Fix 1: Use Actual Relevance Scoring ✅ COMPLETED
- ✅ Use `aiPriorityScore` from prioritization to determine relevance
- ✅ Add secondary relevance check using `RelevanceEngine.checkRelevance()`
- ✅ Only save to DiscoveredContent if `aiPriorityScore >= 60` AND `relevanceEngine.isRelevant === true` AND `content.length > 500`
- ✅ Set `isUseful` based on relevance, not just length

### Fix 2: Trigger Hero Pipeline ✅ COMPLETED
- ✅ After saving to DiscoveredContent, trigger hero image generation via `/api/internal/enrich/[id]`
- ✅ Use existing hero pipeline enrichment API
- ✅ Hero URL will be populated by hero pipeline (currently JsonNull, will be updated)

### Fix 3: Use Relevance Engine ✅ COMPLETED
- ✅ Import and use `RelevanceEngine` in `wikipediaProcessor.ts`
- ✅ Pass patch name/handle to get correct entity profile
- ✅ Use relevance result to filter citations before saving

## Implementation Details

### Changes Made:

1. **`wikipediaCitation.ts`**: Updated `getNextCitationToProcess()` to return `aiPriorityScore`
2. **`wikipediaProcessor.ts`**: 
   - Added `RelevanceEngine` integration in `processNextCitation()`
   - Combined AI priority score (>=60) with RelevanceEngine check
   - Only save citations that pass both checks
   - Trigger hero generation after saving
   - Log detailed relevance decisions
3. **`engineV21.ts`**: 
   - Updated `saveAsContent` signature to accept relevance data
   - Calculate combined relevance score (60% AI, 40% RelevanceEngine)
   - Set `isUseful` based on actual relevance
   - Store AI and relevance engine scores in metadata

### Expected Results:

- **Fewer irrelevant citations**: Only citations with AI score >=60 AND RelevanceEngine approval will be saved
- **Better relevance**: Citations must mention Chicago Bulls entities/people/keywords
- **Hero images**: Will be generated automatically via enrichment API
- **Better filtering**: "Canadian Premier League" type citations will be rejected

