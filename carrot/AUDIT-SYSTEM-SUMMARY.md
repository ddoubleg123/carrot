# Citation Audit System - Summary

## What Changed

**Before**: Time-based rule (30-day requirement)
- Only reprocessed citations if they were scanned 30+ days ago
- Arbitrary time limit didn't reflect actual need for reprocessing

**After**: Audit-based system
- Identifies anomalies that suggest incorrect denial
- Reprocesses based on "does this make sense?" not "how long ago?"
- No arbitrary time limits

## How It Works

### Audit Criteria (6 Signals)

1. **High AI Score + Denied** (up to 60 points)
   - AI says it's relevant (score >= 60) but we denied it
   - Strongest signal of incorrect denial

2. **Substantial Content + Denied** (20 points)
   - Extracted 5000+ chars but denied
   - If we got this much content, it likely passed basic checks

3. **Good Content + Denied** (10 points)
   - Extracted 2000-4999 chars but denied

4. **Content Extracted + Denied** (5 points)
   - Extracted 1000+ chars but denied

5. **Recent Scan + High Score + Denied** (10 points)
   - Scanned within 7 days with high score but denied
   - Might indicate a recent bug

6. **Verified External URL + High Score + Denied** (5 points)
   - External URL verified with high score but denied

### Reprocessing Decision

- **Audit Score >= 50**: Should reprocess
- **Priority**:
  - High (>= 70): Strong anomalies
  - Medium (50-69): Moderate anomalies
  - Low (< 50): Don't reprocess

## Real Example

**Citation `cmip9so2u0561ox1t56gue2ye`**:
- AI Score: 95
- Content: 7,574 chars
- Verified: Yes
- Scanned: 3 days ago

**Audit Score: 97/100** ✅
- High AI Score: 57 points
- Substantial Content: 20 points
- Content Extracted: 5 points
- Recent Scan: 10 points
- Verified External: 5 points

**Result**: Should reprocess, Priority: HIGH

## Benefits

1. **Immediate Response**: Fixes bugs take effect immediately
2. **Focused**: Only reprocesses citations that "don't make sense"
3. **Prioritized**: Highest audit scores processed first
4. **Context-Aware**: Considers multiple signals, not just time

## Files Changed

1. `carrot/src/lib/discovery/citationAudit.ts` - New audit system
2. `carrot/src/lib/discovery/wikipediaCitation.ts` - Integrated audit into citation selection
3. `carrot/scripts/test-citation-audit.ts` - Test script
4. `carrot/CITATION-AUDIT-SYSTEM.md` - Full documentation

## Next Steps

The audit system is now active. On the next discovery run:
- Will find citations with audit scores >= 50
- Will prioritize highest scores first
- Will reprocess them with the fixed scoring logic
- Should save them correctly this time

