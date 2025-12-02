# Wikipedia Citation Relevance Fix Plan

## Current Problem

**We're scoring citations BEFORE fetching their content!**

Current flow (WRONG):
1. Extract citations from Wikipedia page (title, URL, context only)
2. Call DeepSeek to score citations based on title/URL/context (NO CONTENT!)
3. Store scores in database
4. Later: Fetch citation URL content
5. Check relevance with RelevanceEngine
6. Save if relevant

**Problem**: DeepSeek is scoring based on incomplete information (just title/URL), not the actual article content.

## Correct Flow (What User Wants)

1. **Identify Wikipedia page** ✅
2. **Save number of citations** ✅
3. **Add each citation to database** (without score yet)
4. **For each citation:**
   - Fetch the actual URL content
   - Call DeepSeek to score the ACTUAL CONTENT
   - Use DeepSeek score to determine relevance
   - Only save to DiscoveredContent if DeepSeek approves

## Implementation Plan

### Step 1: Remove Early DeepSeek Prioritization
- Remove `prioritizeCitations()` call from `processNextWikipediaPage()`
- Store citations in database WITHOUT `aiPriorityScore` initially (set to null)
- Citations should be stored with `verificationStatus: 'pending'` and `scanStatus: 'not_scanned'`

### Step 2: Add DeepSeek Content Scoring
- In `processNextCitation()`, AFTER fetching content:
  - Extract text content from citation URL
  - Call DeepSeek with the ACTUAL CONTENT to score relevance
  - Store score in `aiPriorityScore` field
  - Use score to determine if citation is relevant

### Step 3: Update Relevance Logic
- Primary relevance check: DeepSeek score based on actual content
- Secondary check: RelevanceEngine (for additional validation)
- Only save to DiscoveredContent if DeepSeek score meets threshold (e.g., >= 60)

### Step 4: Update Save Logic
- Only save citations that pass DeepSeek content scoring
- Set `isUseful: true` only for high-scoring citations
- Don't save irrelevant citations to DiscoveredContent at all

## Files to Modify

1. `carrot/src/lib/discovery/wikipediaProcessor.ts`
   - Remove `prioritizeCitations()` call from `processNextWikipediaPage()`
   - Add DeepSeek content scoring in `processNextCitation()` after content fetch
   - Update relevance logic to use DeepSeek content score

2. `carrot/src/lib/discovery/wikipediaCitation.ts`
   - Update `extractAndStoreCitations()` to not require prioritization
   - Store citations without `aiPriorityScore` initially

## DeepSeek Content Scoring Prompt

When we have the actual content, we should ask DeepSeek:

```
You are analyzing an article to determine its relevance to the topic: "{topic}".

Topic: "{topic}" (aliases: {aliases})
Source: {citationUrl}
Title: {title}

Article Content:
{actualContentText}

Task: Score this article (0-100) based on:
1. Relevance to the core topic ({topic})
2. Quality and depth of information
3. Importance/authority of the source
4. Whether it contains valuable, factual information about the topic

Return JSON:
{
  "score": 85,
  "reason": "Article discusses key events in Chicago Bulls history",
  "isRelevant": true
}
```

## Benefits

1. **Accurate scoring**: Based on actual content, not just title/URL
2. **Better relevance**: DeepSeek can read the full article and make informed decision
3. **No irrelevant content**: Only saves articles that DeepSeek approves after reading
4. **Proper prioritization**: Citations are scored based on what they actually say
