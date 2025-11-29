# Importance Scoring System

## Overview

The importance scoring system distinguishes between **important, meaningful content** about a subject and **generic, routine content** that happens to mention the subject.

## How It Works

### 1. Vetter Evaluation

The vetter (LLM) evaluates each piece of content and assigns an `importanceScore` (0-100):

- **HIGH IMPORTANCE (80-100)**: Core subject matter, key people, major events, franchise history, foundational concepts, legacy-defining moments
- **MEDIUM IMPORTANCE (50-79)**: Current roster analysis, season previews, player development, draft picks, significant but routine news
- **LOW IMPORTANCE (0-49)**: Game recaps, routine injury updates, trade rumors, social media posts, daily news, match previews

### 2. Filtering

Discovery engine automatically rejects content with `importanceScore < 50`:

```typescript
const MIN_IMPORTANCE_SCORE = 50
if (importanceScore < MIN_IMPORTANCE_SCORE) {
  // Reject: low_importance
}
```

### 3. Examples

**High Importance (80-100):**
- "Michael Jordan's Legacy and the 1990s Dynasty"
- "Phil Jackson's Triangle Offense Philosophy"
- "Chicago Bulls Championship History"
- "Scottie Pippen's Hall of Fame Career"

**Low Importance (0-49):**
- "Bulls vs Bucks Game Recap"
- "Injury Update: Player X Out 2 Weeks"
- "Trade Rumor: Bulls Interested in Player Y"
- "Post-Game Quotes from Last Night"

## Configuration

### Group Profiles

Importance keywords are defined in `groupProfiles.ts`:

```typescript
importance_keywords: {
  high: [
    'michael jordan',
    'championship',
    'dynasty',
    'phil jackson',
    // ...
  ],
  low: [
    'game recap',
    'injury update',
    'trade rumor',
    // ...
  ]
}
```

### Thresholds

- `MIN_IMPORTANCE_SCORE = 50`: Minimum score to accept content
- `PREFERRED_IMPORTANCE_SCORE = 70`: Preferred score for high-priority content

## Testing

### 1. Run Discovery

```bash
# Start discovery for Chicago Bulls
# Check logs for importanceScore values
```

### 2. Verify Filtering

Check logs for `low_importance` events:
```json
{
  "event": "low_importance",
  "importanceScore": 35,
  "url": "https://nba.com/bulls/news/game-recap"
}
```

### 3. Verify High-Importance Content

Check that important content is saved:
```json
{
  "event": "saved",
  "importanceScore": 85,
  "title": "Michael Jordan's Legacy"
}
```

## Tuning

### Adjust Minimum Threshold

Edit `carrot/src/lib/discovery/engineV21.ts`:

```typescript
// More strict (only high-importance)
const MIN_IMPORTANCE_SCORE = 70

// More lenient (allow medium-importance)
const MIN_IMPORTANCE_SCORE = 40
```

### Update Keywords

Edit `carrot/src/lib/discovery/groupProfiles.ts` to add/remove importance keywords based on your subject matter.

## Database

The `importanceScore` is stored in the `discovered_content` table:

```sql
ALTER TABLE discovered_content 
ADD COLUMN importance_score DOUBLE PRECISION NOT NULL DEFAULT 50.0;
```

## Monitoring

Importance scores are logged in:
- Structured logs: `low_importance`, `score_threshold`
- Audit events: `synthesis` events include `importanceScore`
- Database: `discovered_content.importance_score` column

## Future Enhancements

1. **Dynamic Thresholds**: Adjust `MIN_IMPORTANCE_SCORE` based on content volume
2. **Importance Boost**: Increase priority for high-importance content in frontier
3. **User Feedback**: Learn from user interactions to refine importance scoring
4. **Topic-Specific Rules**: Different importance criteria for different topics

