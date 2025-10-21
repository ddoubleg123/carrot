# Content Quality Audit Implementation

## Overview

The Content Modal v2 implements a **multi-tier quality gate** to ensure all displayed content meets strict standards for substance, accuracy, and clarity. This document explains how the quality audit works.

---

## Quality Gate Architecture

### 1. **Initial Content Extraction** (`start-discovery/route.ts`)

When content is first discovered:
- DeepSeek searches for high-quality, authoritative sources
- URL validation checks for broken/generic pages
- Basic content extraction via regex parsing
- Items marked as `status: 'ready'` or `status: 'denied'`

### 2. **On-Demand Enrichment** (`preview/route.ts`)

When a user opens the Content Modal:
- Check if existing `enrichedContent` meets quality standards
- **Quality Gate Trigger**: If `summary.length < 120` OR `keyPoints.length < 3`
- Invoke **DeepSeek AI enrichment** with retry logic

---

## DeepSeek AI Enrichment Pipeline

### Step 1: Quality Check

```typescript
if (preview.summary.length < 120 || preview.keyPoints.length < 3) {
  // QUALITY GATE FAILED - trigger AI enrichment
}
```

### Step 2: Content Preparation

- Extract clean article text (fetch source if needed)
- Get patch tags for context
- Build structured prompt via `generateSummaryPrompt()`

### Step 3: DeepSeek API Call

```typescript
const enrichmentResult = await enrichContentWithDeepSeek(
  articleText,
  title,
  sourceUrl,
  patchTags
)
```

**Request Parameters:**
- Model: `deepseek-chat`
- Temperature: `0.2` (low for factual output)
- Max tokens: `2048`
- Streaming: Yes

### Step 4: Response Validation

Using `zod` schema (`SummaryContractSchema`):

**Required Fields:**
- `summary`: 120-240 chars, 2-3 sentences
- `keyFacts`: Array of 3-7 items, each 20-200 chars
- `context`: 50-300 chars, explains relevance to group
- `entities`: 0-10 items (people/teams/places)

**Quality Checks:**
- ❌ Reject boilerplate words without facts (e.g., "iconic", "legendary")
- ❌ Reject filler phrases (e.g., "it is known", "many people")
- ❌ Reject facts < 5 words
- ✅ Require specific facts (dates, numbers, names)

### Step 5: Retry Logic

If validation fails on first attempt:
- Retry **once** with same prompt
- If still fails → fallback to simple extraction

### Step 6: Database Persistence

Successful AI enrichment is saved:
```typescript
enrichedContent: {
  summary150,
  keyPoints,
  context,
  aiEnriched: true,  // Flag for audit trail
  enrichedAt: ISO timestamp
}
```

---

## Example: Good vs Bad Output

### ✅ **GOOD** (Passes Validation)

```json
{
  "summary": "Michael Jordan scored 63 points against the Boston Celtics in the 1986 NBA Playoffs, setting a playoff record that stood for over 20 years. Larry Bird called him 'God disguised as Michael Jordan' after the game.",
  "keyFacts": [
    {
      "text": "Scored 63 points in Game 2 of the 1986 Eastern Conference First Round",
      "date": "April 20, 1986"
    },
    {
      "text": "Previous playoff scoring record was 61 points by Elgin Baylor in 1962"
    },
    {
      "text": "Bulls lost the game 135-131 in double overtime despite Jordan's performance"
    }
  ],
  "context": "This performance established Jordan as an elite playoff performer early in his career and set the standard for individual dominance in postseason basketball that defined the Bulls' dynasty era.",
  "entities": ["Michael Jordan", "Larry Bird", "Boston Celtics", "Chicago Bulls"]
}
```

### ❌ **BAD** (Fails Validation)

```json
{
  "summary": "Michael Jordan had an iconic performance.",
  "keyFacts": [
    { "text": "Had an amazing game" },
    { "text": "Is known for his incredible skills" }
  ]
}
```

**Rejection Reasons:**
- Summary < 120 chars
- Contains "iconic" without specific facts
- Key facts < 3 items
- Facts are vague, no concrete data
- No dates, numbers, or specifics

---

## Fallback Strategy

If DeepSeek enrichment fails (API error, timeout, validation):

### Fallback Enrichment (`enrichContentFallback`)

1. **Summary**: First 2 sentences from article
2. **Key Facts**: Extract sentences with:
   - Numbers (dates, stats)
   - Action verbs (said, announced, reported)
   - Minimum 3 facts, maximum 7
3. **Context**: Generic relevance statement
4. **Entities**: Empty array (no AI extraction)

### Last Resort

If all else fails:
- Summary: Truncate `content` field to 240 chars
- Key Facts: Split sentences, filter by length
- User still sees *something* rather than blank modal

---

## Monitoring & Debugging

### Logs to Watch

```
[ContentPreview] Quality gate failed for {id} - re-running with DeepSeek
[EnrichContent] Attempt 1 for {url}
[EnrichContent] ✅ Successfully enriched content
[ContentPreview] ✅ DeepSeek enrichment successful for {id}
```

### Failure Logs

```
[EnrichContent] ⚠️ Validation failed: [errors]
[ContentPreview] ⚠️ DeepSeek enrichment failed, using fallback
```

### Database Audit

Check `enrichedContent.aiEnriched` field:
- `true`: Content passed DeepSeek quality gate
- Missing/false: Fallback enrichment used

---

## Performance Considerations

### Caching Strategy

1. **In-Memory Cache**: Preview API caches results for 6 hours
2. **Database Cache**: Enriched content persists permanently
3. **Trigger**: Only re-enriches if quality gate fails

### Cost Optimization

- Enrichment only runs **on-demand** when modal opens
- Retry limit: **1 retry max** (2 total attempts)
- Streaming response: Lower latency than blocking call
- Fallback: No cost if AI fails

---

## Testing Quality Audit

### Test Case 1: Good Existing Content
- Open modal for content with `summary.length >= 120` and `keyPoints.length >= 3`
- **Expected**: No DeepSeek call, immediate display

### Test Case 2: Poor Existing Content
- Open modal for content with `summary.length < 120`
- **Expected**: DeepSeek enrichment triggered, improved summary displayed

### Test Case 3: DeepSeek Failure
- Simulate API timeout/error
- **Expected**: Fallback enrichment used, modal still displays

---

## Future Enhancements

1. **Batch Enrichment**: Pre-enrich content after discovery (background job)
2. **Quality Scoring**: Track enrichment success rate per source domain
3. **User Feedback**: Allow users to flag poor summaries for re-enrichment
4. **A/B Testing**: Compare AI vs fallback enrichment quality
5. **Multi-Model**: Try multiple LLMs if DeepSeek fails (GPT-4, Claude)

---

## Compliance

This implementation ensures:
- ✅ **Fair Use**: Never displays full articles, only summaries
- ✅ **Attribution**: Source domain always shown with link
- ✅ **Accuracy**: AI-generated summaries validated against strict schema
- ✅ **Transparency**: Users see "why this matters" context
- ✅ **Auditability**: All enrichments logged and timestamped
