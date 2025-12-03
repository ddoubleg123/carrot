# DeepSeek Scoring Prompt Analysis

## Current Prompt Structure

**Location**: `carrot/src/lib/discovery/wikipediaProcessor.ts:159-189`

```typescript
const prompt = `Analyze this content for relevance to "${topic}":

Title: ${title}
URL: ${url}
Content: ${contentText.substring(0, 10000)}${contentText.length > 10000 ? '...' : ''}

IMPORTANT: First verify this is an actual article, not a metadata/catalog page.

Return JSON:
{
  "score": 0-100,
  "isRelevant": boolean,
  "isActualArticle": boolean,
  "contentQuality": "high" | "medium" | "low",
  "reason": string
}

Scoring criteria:
1. Is this an actual article? (not a library catalog, authority file, or metadata page)
2. How directly does it relate to "${topic}"?
3. Does it contain valuable, substantive information about "${topic}"?
4. What is the depth and quality of information?

Reject (score < 60) if:
- It's a library catalog entry
- It's an authority file or metadata page
- It's just metadata with no narrative content
- Content is too short or lacks substance
- It's not actually about "${topic}"

Return ONLY valid JSON, no other text.`
```

## Issues Identified

### Issue 1: Hardcoded Score of 30 for Non-Articles ⚠️

**Location**: `wikipediaProcessor.ts:238-244`

```typescript
if (!isActuallyAnArticle) {
  return {
    score: 30, // Low score for non-articles
    isRelevant: false,
    reason: 'Not an actual article (metadata/catalog page)'
  }
}
```

**Problem**: 
- If `isActualArticle()` returns false, the function immediately returns score 30 without calling DeepSeek
- This explains why many citations have `aiPriorityScore: 30`
- The `isActualArticle()` function requires:
  - Content length >= 1000 chars
  - At least 3 paragraphs
  - Narrative indicators (sentences with proper structure)
  - Not a catalog/authority page

**Examples from database**:
- "Policy publications..." - 7 chars → Fails 1000 char check → Gets 30
- "True Peace" - 90 chars → Fails 1000 char check → Gets 30
- "Gush-Shalom" - 419 chars → Fails 1000 char check → Gets 30

### Issue 2: Content Extraction May Be Failing

**Problem**: Some citations have very short content (7 chars, 90 chars), suggesting:
- HTML extraction is failing
- Content is being truncated incorrectly
- The page might be JavaScript-rendered and not being captured

**Location**: `wikipediaProcessor.ts:720-726`
```typescript
const textContent = html
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 50000) // Limit to 50k chars
```

This is a very basic HTML extraction - might need better parsing.

### Issue 3: Topic String May Be Too Generic

**Problem**: The topic is just `"Israel"` (the patch name), but citations are often about:
- "Israel-Palestine conflict"
- "Israeli-Palestinian relations"
- "History of Israel"
- "Israeli politics"

The prompt asks "How directly does it relate to 'Israel'?" which might be too strict. A citation about "Israel-Palestine conflict" is highly relevant to "Israel" but might not score well if DeepSeek interprets "directly" too narrowly.

### Issue 4: Prompt May Be Too Strict

**Problem**: The prompt says "Reject (score < 60) if:" and lists several conditions. This might make DeepSeek:
- Overly cautious
- Score everything lower to be safe
- Reject borderline cases that are actually relevant

### Issue 5: Content Truncation

**Problem**: Content is truncated to 10,000 chars for the prompt:
```typescript
Content: ${contentText.substring(0, 10000)}${contentText.length > 10000 ? '...' : ''}
```

But some citations have 31,576 chars, 50,000 chars. DeepSeek might not see the full context.

## Why Citations Are Scoring 30

Based on the database analysis, citations are scoring 30 for these reasons:

1. **Short Content (Fails `isActualArticle` check)**: 7 chars, 90 chars, 419 chars
   - These get hardcoded score 30 without DeepSeek call
   
2. **DeepSeek Scoring Low**: Even citations with long content (31,576 chars) are scoring 30
   - This suggests DeepSeek itself is scoring them low
   - Possible reasons:
     - Topic "Israel" is too generic
     - Prompt is too strict
     - Content quality is actually low
     - DeepSeek is being overly cautious

## Recommendations

### Fix 1: Improve Content Extraction
- Use a better HTML parser (e.g., `cheerio` or `jsdom`)
- Handle JavaScript-rendered content
- Better text extraction from article bodies

### Fix 2: Expand Topic Context
Instead of just `"Israel"`, pass more context:
- `"Israel"` → `"Israel, Israeli-Palestinian conflict, Israeli politics, Israeli history"`
- Or use patch description/tags for better context

### Fix 3: Adjust Prompt Tone
Make the prompt less strict:
- Change "Reject (score < 60) if:" to "Consider lower scores if:"
- Add guidance: "Score 60-100 for highly relevant content, 40-59 for moderately relevant"
- Clarify that "Israel-Palestine conflict" content IS directly relevant to "Israel"

### Fix 4: Lower Threshold Temporarily
- Current: 60/100
- Suggested: 40-50/100 for testing
- This will help us see if citations are actually relevant

### Fix 5: Better Error Handling
- When `isActualArticle()` fails, still call DeepSeek (don't hardcode 30)
- Let DeepSeek decide if it's an article or not
- Log why `isActualArticle()` failed for debugging

### Fix 6: Increase Content Limit
- Current: 10,000 chars
- Suggested: 20,000-30,000 chars
- Or use a smarter truncation (keep first 5k + last 5k)

## Sample Improved Prompt

```typescript
const prompt = `Analyze this content for relevance to "${topic}" and related topics (e.g., ${topic}-Palestine conflict, ${topic}i politics, ${topic}i history):

Title: ${title}
URL: ${url}
Content: ${contentText.substring(0, 20000)}${contentText.length > 20000 ? '...' : ''}

IMPORTANT: First verify this is an actual article, not a metadata/catalog page.

Return JSON:
{
  "score": 0-100,
  "isRelevant": boolean,
  "isActualArticle": boolean,
  "contentQuality": "high" | "medium" | "low",
  "reason": string
}

Scoring guidelines:
- 90-100: Highly relevant, substantial content directly about "${topic}" or closely related topics
- 70-89: Very relevant, good quality content about "${topic}" or related topics
- 50-69: Moderately relevant, some connection to "${topic}" or related topics
- 30-49: Loosely relevant, minimal connection
- 0-29: Not relevant or not an actual article

Consider lower scores (but don't automatically reject) if:
- It's a library catalog entry or metadata page
- Content is very short or lacks substance
- It's only tangentially related to "${topic}"

Return ONLY valid JSON, no other text.`
```

