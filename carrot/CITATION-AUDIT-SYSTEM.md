# Citation Audit System

## Overview

The Citation Audit System replaces time-based rules (like the 30-day requirement) with intelligent anomaly detection. It identifies citations that "don't make sense" and should be reprocessed based on audit criteria, not arbitrary time limits.

## Philosophy

Instead of asking "How long ago was this scanned?", we ask **"Does this decision make sense?"**

The audit system flags anomalies like:
- High AI score but denied (AI says it's relevant, but we denied it)
- Substantial content but denied (we extracted lots of content, but denied it)
- Verified URL but denied (URL works, but we denied it)

## Audit Criteria

### 1. High AI Score + Denied (Up to 60 points)
**Weight**: Up to 60 points (based on AI score, capped at 100)

**Logic**: If AI gives a high score (>= 60) but we denied it, that's a strong signal something is wrong.

- Score >= 80: "CRITICAL" - Very high confidence from AI
- Score >= 70: "HIGH" - High confidence from AI  
- Score >= 60: "MEDIUM" - Above threshold

**Example**: Citation with AI score 95 but denied = 57 points (95 * 0.6)

### 2. Substantial Content + Denied (20 points)
**Weight**: 20 points

**Logic**: If we extracted 5000+ chars of content, it likely passed basic checks. Why deny it?

**Example**: Citation with 7,574 chars but denied = 20 points

### 3. Good Content + Denied (10 points)
**Weight**: 10 points

**Logic**: If we extracted 2000-4999 chars, that's still good content.

**Example**: Citation with 3,000 chars but denied = 10 points

### 4. Content Extracted + Denied (5 points)
**Weight**: 5 points

**Logic**: If we extracted any content (>= 1000 chars), it passed initial checks.

**Example**: Citation with 1,500 chars but denied = 5 points

### 5. Recent Scan + High Score + Denied (10 points)
**Weight**: 10 points

**Logic**: If we just scanned it (within 7 days) and it scored high but was denied, might be a recent bug.

**Example**: Citation scanned 3 days ago with score 95 but denied = 10 points

### 6. Verified External URL + High Score + Denied (5 points)
**Weight**: 5 points

**Logic**: External URLs that verify are usually good sources. If it verified and scored high but was denied, that's suspicious.

**Example**: Verified external URL with score 75 but denied = 5 points

## Audit Score Calculation

The audit system calculates a score (0-100) based on the criteria above:

```typescript
auditScore = 
  (AI Score * 0.6, capped at 60) +  // High AI score weight
  (Substantial Content: 20) +        // 5000+ chars
  (Good Content: 10) +                // 2000-4999 chars
  (Content Extracted: 5) +           // 1000+ chars
  (Recent Scan: 10) +                 // Scanned <7 days ago
  (Verified External: 5)              // External URL verified
```

## Reprocessing Threshold

**Threshold**: Audit score >= 50 triggers reprocessing

**Priority Levels**:
- **High** (score >= 70): Strong anomalies, definitely should reprocess
- **Medium** (score >= 50): Moderate anomalies, worth reprocessing
- **Low** (score < 50): Weak signals, don't reprocess

## Example: Citation cmip9so2u0561ox1t56gue2ye

### Citation Details:
- AI Score: 95
- Relevance Decision: denied
- Verification Status: verified
- Content Length: 7,574 chars
- Last Scanned: 3 days ago
- URL: External (aljazeera.com)

### Audit Calculation:
1. High AI Score: 95 * 0.6 = **57 points**
2. Substantial Content: 7,574 chars = **20 points**
3. Content Extracted: 7,574 chars = **5 points**
4. Recent Scan: 3 days ago = **10 points**
5. Verified External: Yes = **5 points**

**Total Audit Score: 97/100** ✅

**Result**: Should reprocess (score >= 50), Priority: HIGH

## Benefits Over Time-Based Rules

### 1. Immediate Response to Bugs
- When we fix a bug, affected citations are immediately flagged for reprocessing
- No need to wait 30 days to see the fix take effect

### 2. Focuses on Anomalies
- Only reprocesses citations that "don't make sense"
- Low-scoring denied citations (score < 60) won't be reprocessed
- Saves resources by not reprocessing everything

### 3. Prioritizes by Severity
- Highest audit scores are processed first
- Citations with multiple anomalies get higher priority
- System focuses on the most likely incorrect denials

### 4. Adapts to Context
- Recent scans with high scores = possible recent bug
- Substantial content = likely passed basic checks
- Verified URLs = likely good sources

## Integration

The audit system is integrated into `getNextCitationToProcess()`:

1. **Step 1**: Try new citations (not scanned, no decision)
2. **Step 2**: Try Wikipedia internal links
3. **Step 3**: **Use audit system** to find denied citations that should be reprocessed
4. **Step 4**: Try citations marked "saved" but save failed

The audit system evaluates up to 100 denied citations and selects the one with the highest audit score.

## Future Enhancements

Potential additions to the audit system:

1. **Pattern Detection**: If many citations from the same domain were denied, flag them
2. **Source Quality**: If citation is from a high-quality source (e.g., NYTimes) but denied, flag it
3. **Manual Flags**: Allow manual flagging of citations for review
4. **Historical Patterns**: If a citation was previously saved but now denied, flag it
5. **Content Quality Metrics**: Use additional quality signals (sentence count, paragraph structure, etc.)

## Testing

Run the test script to see the audit system in action:

```bash
npx tsx carrot/scripts/test-citation-audit.ts
```

This will show:
- Audit criteria and weights
- Test results for specific citations
- Audit scores and reasons for reprocessing

