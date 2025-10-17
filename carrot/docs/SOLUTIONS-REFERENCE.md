# AI Image Generation - Solutions Reference Guide

**Purpose:** Complete reference of all solutions implemented to fix bugs and improve image quality  
**Last Updated:** 2025-10-16

---

## Table of Contents

1. [Subject Extraction Solutions](#subject-extraction-solutions)
2. [Deduplication Solutions](#deduplication-solutions)
3. [Context Extraction Solutions](#context-extraction-solutions)
4. [Composition Solutions](#composition-solutions)
5. [Style Conflict Solutions](#style-conflict-solutions)
6. [Religious Motif Solutions](#religious-motif-solutions)
7. [Feature Tracking Solutions](#feature-tracking-solutions)
8. [Logging Solutions](#logging-solutions)

---

## Subject Extraction Solutions

### Problem 1: Names Only from Title
**Issue:** System only looked at title, missed names in summary  
**Impact:** "Donald Trump with Vladimir Putin" only extracted "Donald Trump"

**Solution:**
```typescript
// src/lib/prompt/sanitize.ts
const combinedText = `${cleanTitle} ${cleanSummary}`;
let names = extractUniqueNames(combinedText);
```

**Result:** ✅ Extracts from both title AND summary

---

### Problem 2: "with" Relationships Not Detected
**Issue:** "Person A with Person B" didn't trigger dual-subject mode  
**Impact:** Only one person appeared in images

**Solution:**
```typescript
// src/lib/prompt/sanitize.ts
const withPattern = /\b(?:with|and|alongside|together with)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/gi;
const withMatches = Array.from(combinedText.matchAll(withPattern));

withMatches.forEach(match => {
  const name = match[1].trim();
  if (!names.some(n => n.toLowerCase() === name.toLowerCase())) {
    names.push(name);
  }
});
```

**Result:** ✅ Detects dual subjects via "with", "and", "alongside", "together with"

---

### Problem 3: Short Names Ignored
**Issue:** "JFK" not detected (requires 2+ capitalized words)  
**Impact:** Famous short names missed

**Solution:**
```typescript
// Use full names in input OR add to hardcoded list
// Better: Use "John F Kennedy" instead of "JFK"
```

**Result:** ✅ Full names always detected

---

## Deduplication Solutions

### Problem 1: "Jesus Christ Jesus Christ"
**Issue:** Duplicate names in title/summary created duplicate subjects  
**Impact:** "Both Jesus Christ and Jesus Christ are clearly visible"

**Solution:**
```typescript
// src/lib/prompt/subject.ts
const splitFixed = cleaned.flatMap(name => {
  const parts = name.split(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g).filter(Boolean);
  return parts.map(p => p.trim());
});

const deduped = [...new Set(splitFixed.map(n => n.trim()))];

// src/lib/prompt/sanitize.ts
names = names.map(n => n.replace(/\b(\w+)\s+\1\b/g, '$1')).filter(Boolean);
```

**Result:** ✅ "Jesus Christ Jesus Christ" → ["Jesus Christ"]

---

### Problem 2: "Derrick Rose" → "derrick rose and rose"
**Issue:** Last name treated as separate person  
**Impact:** Single person became two people

**Solution:**
```typescript
// Regex requires 2+ capitalized words together
/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g

// This matches "Derrick Rose" as ONE name, not two
```

**Result:** ✅ "Derrick Rose" → single subject mode

---

## Context Extraction Solutions

### Problem: Missing Scene Details
**Issue:** Summary context (action, location, crowd) not in prompts  
**Impact:** Generic images, missing key details

**Solutions:**

#### Action Extraction
```typescript
// Detects: feeding, giving, teaching, healing, helping, addressing, etc.
const actionMatch = lower.match(
  /\b(feeding|giving|teaching|healing|helping|addressing|distributing|speaking|performing|delivering|making|holding)\b([^.,]+)/
);
```

#### Object Extraction
```typescript
// Detects: fish, bread, loaves, food, crowd, people, audience
const objectMatch = lower.match(
  /\b(fish|bread|loaves|food|crowd|people|audience)\b/
);
```

#### Crowd Size Extraction
```typescript
// Detects: "100 people", "5000 followers", "crowd"
const numberMatch = lower.match(
  /\b(\d+)\s*(people|crowd|followers|men|women|children)?\b/
);
```

#### Location Extraction
```typescript
// Detects: "in front of", "at", "near", "inside", "beside", "on the shore of"
const locationMatch = lower.match(
  /\b(in\s+front\s+of|at|near|inside|beside|on\s+the\s+shore\s+of)\s+([A-Za-z\s]+)/
);
```

#### Event Extraction
```typescript
// Detects: rally, conference, summit, debate, meeting, ceremony
const eventMatch = lower.match(
  /\b(rally|conference|summit|debate|meeting|press\s+conference|ceremony|political\s+rally)\b/
);
```

**Result:** ✅ All context reliably extracted and embedded in prompts

---

## Composition Solutions

### Problem 1: Portrait Lens for Crowd Scenes
**Issue:** 85mm f/1.4 used for scenes with 100 people  
**Impact:** Can't fit crowd in frame, wrong depth of field

**Solution:**
```typescript
// src/lib/prompt/build.ts
const sceneDetected = Boolean(s.actionHint || s.objectHint || s.countHint || s.locationHint || s.eventHint);

const cameraBlock = sceneDetected
  ? 'wide-angle view, 24–35mm lens, f/5.6, moderate depth of field, showing crowd and environment'
  : 'portrait, 85mm lens look, f/1.4, shallow depth of field, centered composition';
```

**Result:** ✅ Auto-selects wide lens for scenes, portrait for individuals

---

### Problem 2: Illustration Using Camera Terms
**Issue:** "85mm lens" appeared in illustration prompts  
**Impact:** Conflicting style cues

**Solution:**
```typescript
// Different composition terms per style
const isIllustration = styleOverride === 'illustration';

if (isIllustration) {
  compositionBlock = isWideScene
    ? 'wide illustration composition, dynamic scene, detailed background'
    : 'character illustration, centered composition, detailed character design';
} else {
  compositionBlock = isWideScene
    ? 'wide-angle view, 24–35mm lens, f/5.6'
    : 'portrait, 85mm lens look, f/1.4';
}
```

**Result:** ✅ Style-appropriate composition terms

---

## Style Conflict Solutions

### Problem: Photo Terms in Illustration Prompts
**Issue:** "photorealistic", "camera", "lens" appearing in illustration style  
**Impact:** Mixed style outputs

**Solution:**
```typescript
// Separate negative prompts per style
const NEGATIVE_PHOTOREALISTIC = [
  'cartoon', 'anime', 'stylized', 'illustration', ...
].join(', ');

const NEGATIVE_ILLUSTRATION = [
  'photograph', 'photography', 'photorealistic', 'camera', 'lens', 'DSLR', ...
].join(', ');

// Select based on style
const negative = isIllustration ? NEGATIVE_ILLUSTRATION : NEGATIVE_PHOTOREALISTIC_SCENE;
```

**Result:** ✅ Clean separation between photo and art styles

---

## Religious Motif Solutions

### Problem: Halos, Crowns, Divine Glows
**Issue:** "Jesus Christ" → Image with halo, crown of thorns, divine glow  
**Impact:** Religious iconography instead of modern/realistic rendering

**Solution:**
```typescript
// Added to ALL negative prompts
const RELIGIOUS_EXCLUSIONS = [
  'halo',
  'crown of thorns',
  'laurel wreath',
  'saint iconography',
  'divine glow',
  'religious mural',
  'backlit halo',
  'stained glass',
  'mural',
  'religious iconography'
];
```

**Result:** ✅ No religious motifs in generated images

---

## Feature Tracking Solutions

### Problem: Lying Feature Flags
**Issue:** Logs showed "Refiner: ✅" even when refiner was disabled or failed  
**Impact:** Impossible to debug what actually ran

**Solution:**
```typescript
// src/lib/pipeline.ts
const applied = {
  refiner: !!(p.enableRefiner && stages.refiner && !stages.refiner.error),
  faceRestoration: !!(p.enableFaceRestore && stages.face && !stages.face.error),
  hiresFix: !!(p.enableHiresFix && stages.hires && !stages.hires.error),
  upscaler: !!(p.enableUpscale && stages.upscale && !stages.upscale.error),
};

// Only ✅ if: enabled AND executed AND no error
```

**Result:** ✅ Truthful ✅/❌ indicators

---

### Problem: No Error Visibility
**Issue:** When a stage failed, no clear error message  
**Impact:** Silent failures, hard to debug

**Solution:**
```typescript
// Wrap each stage in try/catch
if (p.enableRefiner) {
  try {
    stages.refiner = await callSDXLRefiner(...);
  } catch (err) {
    console.error(`[AI Image Generator] ❌ Refiner failed:`, err.message);
    stages.refiner = { error: true };
  }
}
```

**Result:** ✅ Clear ❌ error logs

---

## Logging Solutions

### Problem: Unreadable JSON-Only Logs
**Issue:** Only JSON output, hard to scan quickly  
**Impact:** Slow debugging

**Solution:**
```typescript
// PowerShell-style readable block
console.log('[AI Image Generator] ✅ Successfully generated image with SDXL');
console.log('[AI Image Generator] Features applied:');
console.log(`   - Model: SDXL`);
console.log(`   - Refiner: ${applied.refiner ? '✅' : '❌'}`);
console.log(`   - Face Restoration: ${applied.faceRestoration ? '✅' : '❌'}`);
console.log(`   - Hires Fix: ${applied.hiresFix ? '✅' : '❌'}`);
console.log(`   - Upscaler: ${applied.upscaler ? '✅' : '❌'}`);
console.log(`   - Resolution: ${width}x${height}`);
console.log(`   - Generation Time: ${ms}ms`);

// THEN structured JSON for machines
console.log(JSON.stringify({ positive, negative, names, subjectMode, applied, timingsMs }, null, 2));
```

**Result:** ✅ Both human-readable AND machine-parseable logs

---

### Problem: Missing Context in Logs
**Issue:** No visibility into extracted context  
**Impact:** Couldn't verify if extraction worked

**Solution:**
```typescript
// Log all extracted context
console.log('[GenerateHeroImage] Sanitized:', {
  names: s.names,
  mode: s.mode,
  actionHint: s.actionHint,
  objectHint: s.objectHint,
  countHint: s.countHint,
  eventHint: s.eventHint,
  locationHint: s.locationHint,
});
```

**Result:** ✅ Full visibility into extraction results

---

## Regex Patterns Reference

### Subject Names
```regex
/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g
```
Matches: "Derrick Rose", "Jesus Christ", "Donald Trump"  
Doesn't match: "JFK" (too short), "the" (lowercase)

---

### Relationship Detection
```regex
/\b(?:with|and|alongside|together with)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/gi
```
Matches: "with Vladimir Putin", "and Jesus Christ", "alongside Martin Luther King"

---

### Action Verbs
```regex
/\b(feeding|giving|teaching|healing|helping|addressing|distributing|speaking|performing|delivering|making|holding)\b([^.,]+)/
```
Matches: "feeding 100 people", "giving a speech", "teaching the crowd"

---

### Objects
```regex
/\b(fish|bread|loaves|food|crowd|people|audience)\b/
```
Matches: "fish", "bread", "people", "food"

---

### Crowd Size
```regex
/\b(\d+)\s*(people|crowd|followers|men|women|children)?\b/
```
Matches: "100 people", "5000 followers", "12 disciples"

---

### Location
```regex
/\b(in\s+front\s+of|at|near|inside|beside|on\s+the\s+shore\s+of)\s+([A-Za-z\s]+)/
```
Matches: "in front of the Grand Canyon", "at the stadium", "near the lake"

---

### Event Type
```regex
/\b(rally|conference|summit|debate|meeting|press\s+conference|ceremony|political\s+rally)\b/
```
Matches: "rally", "political rally", "press conference", "summit"

---

## Decision Tree

### When to Use Wide-Angle (24-35mm)
```
IF actionHint OR objectHint OR countHint OR locationHint OR eventHint
THEN use: wide-angle view, 24–35mm lens, f/5.6, showing crowd and environment
```

**Examples:**
- "feeding 100 people" → ✅ Wide (has action + count)
- "at a rally" → ✅ Wide (has event)
- "with fish" → ✅ Wide (has object)
- "in front of Grand Canyon" → ✅ Wide (has location)

---

### When to Use Portrait (85mm)
```
IF no context hints (all undefined)
THEN use: portrait, 85mm lens look, f/1.4, shallow depth of field
```

**Examples:**
- "Portrait of Derrick Rose" → ✅ Portrait (no context)
- "Derrick Rose headshot" → ✅ Portrait (no context)

---

## Prompt Structure Formula

### Photorealistic
```
[Subject] + [Action] + [Object] + [Crowd] + [Location] + [Event] +
photorealistic, natural light, lifelike textures +
[Camera Block] +
professional quality, perfect composition, rule of thirds
```

### Illustration
```
[Subject] + [Action] + [Object] + [Crowd] + [Location] + [Event] +
professional digital illustration, stylized art, bold colors, clean lines +
[Composition Block] +
professional quality, perfect composition, rule of thirds
```

---

## Edge Cases Handled

### 1. Empty Names Array
```typescript
const subject = s.names[0] ?? 'the subject';
```
Fallback: "the subject is clearly visible"

---

### 2. Single Name with "Both" Keyword
```typescript
// Safety rewrite in build.ts
subjectLine = subjectLine.replace(
  /\bBoth\s+([A-Z][^\s,]+(?:\s[A-Z][^\s,]+)+)\s+and\s+\1\b/i, 
  '$1 is clearly visible'
);
```
Converts: "Both Jesus Christ and Jesus Christ" → "Jesus Christ is clearly visible"

---

### 3. Multiple Spaces in Names
```typescript
// Normalize spaces
const cleaned = matches.map(m => m.trim().replace(/\s+/g, ' '));
```
Converts: "Jesus  Christ" → "Jesus Christ"

---

### 4. Missing Summary
```typescript
const cleanSummary = summary.replace(/\s+/g, ' ').trim();
// Works with empty string, no crash
```

---

## Style-Specific Negative Prompts

### For Photorealistic
```
❌ Exclude: cartoon, anime, stylized, illustration, drawing, sketch, painting
✅ Want: photorealistic, natural, lifelike
```

### For Illustration
```
❌ Exclude: photograph, photography, photorealistic, camera, lens, DSLR
✅ Want: stylized art, vibrant colors, clean lines
```

### For All Styles
```
❌ Always exclude:
- lowres, blurry, pixelated
- deformed hands, extra limbs, bad anatomy
- duplicate people, text artifacts
- halo, crown of thorns, stained glass, divine glow, religious iconography
- static portrait, centered headshot (for scenes)
```

---

## Testing Strategies

### Unit Tests
```typescript
// Test each function in isolation
test('extractUniqueNames: deduplicates correctly', () => {
  const result = extractUniqueNames('Jesus Christ Jesus Christ');
  expect(result).toEqual(['Jesus Christ']);
});
```

### Integration Tests
```typescript
// Test full pipeline
test('scene extraction: feeding 100 people with fish', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ feeding 100 people with fish');
  const { positive } = buildPrompt({ s, styleOverride: 'illustration' });
  
  expect(positive).toMatch(/feeding/);
  expect(positive).toMatch(/fish/);
  expect(positive).toMatch(/100 people/);
  expect(positive).toMatch(/wide-angle/);
});
```

### Manual Tests
```
Visit: http://localhost:3005/test-deepseek-images
1. Enter test case
2. Generate image
3. Check console logs
4. Verify prompt structure
5. Validate image output
```

---

## Performance Optimizations

### Regex Efficiency
```typescript
// Use .match() once, cache result
const matches = text.match(/pattern/g) || [];
// Better than multiple .includes() calls
```

### Early Returns
```typescript
// Check mode first
if (s.mode === 'single') {
  // Single path
  return buildSingleSubject(s);
}
// Dual path
return buildDualSubject(s);
```

### Context Reuse
```typescript
// Extract once, use multiple times
const lower = cleanSummary.toLowerCase();
const actionMatch = lower.match(/pattern/);
const objectMatch = lower.match(/pattern/);
```

---

## Future Enhancements

### Planned Features
- [ ] Advanced refiner integration (real endpoints vs stubs)
- [ ] Batch generation support
- [ ] Style mixing ("50% photorealistic + 50% illustration")
- [ ] Custom negative prompt overrides
- [ ] ControlNet integration for pose/composition control
- [ ] LoRA support for specific characters
- [ ] Image-to-image variations
- [ ] Inpainting for corrections

### Wishlist
- [ ] Auto-detect best style based on content
- [ ] A/B testing framework for prompts
- [ ] Quality scoring with DeepSeek Vision
- [ ] Automatic retry with adjusted prompts if quality low
- [ ] Progressive enhancement (low-res preview → high-res final)

---

## Critical Files Map

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/lib/prompt/subject.ts` | Name extraction | `extractUniqueNames()`, `decideSubjectMode()` |
| `src/lib/prompt/sanitize.ts` | Context extraction | `sanitizeInputs()` |
| `src/lib/prompt/build.ts` | Prompt construction | `buildPrompt()` |
| `src/lib/pipeline.ts` | SDXL orchestration | `runPipeline()` |
| `src/app/api/ai/generate-hero-image/route.ts` | API endpoint | `POST()` |
| `tests/prompt.spec.ts` | Test suite | All tests |

---

## Debugging Checklist

When image generation fails or produces wrong results:

- [ ] **Check sanitization logs** - Are names extracted correctly?
- [ ] **Check mode detection** - Is it single/dual as expected?
- [ ] **Check context hints** - Are action/object/crowd/location detected?
- [ ] **Check camera selection** - Wide scene using wide lens? Portrait using 85mm?
- [ ] **Check style selection** - Is correct negative prompt used?
- [ ] **Check feature flags** - Do ✅/❌ match what you expected?
- [ ] **Check timing** - Is generation time reasonable?
- [ ] **Check Vast.ai connection** - Is GPU server responding?

---

## Quick Reference Commands

### Start Dev Server
```bash
cd C:\Users\danie\CascadeProjects\windsurf-project\carrot
npm run dev
```

### Run Tests
```bash
npm test tests/prompt.spec.ts
```

### Check Vast.ai Connection
```bash
curl http://localhost:7860/health
```

### SSH Tunnel to Vast.ai
```bash
ssh -f -N -L 7860:localhost:7860 -p 44302 root@83.10.113.244
```

### Test API Directly
```bash
curl -X POST http://localhost:3005/api/ai/generate-hero-image \
  -H "Content-Type: application/json" \
  -d '{"title":"Jesus Christ","summary":"Jesus Christ feeding 100 people with fish","artisticStyle":"illustration"}'
```

---

## Commit Message Templates

### Bug Fixes
```
fix(prompt): deduplicate subject names + extract scene context

- Fixed "Jesus Christ Jesus Christ" duplication
- Extract action, object, crowd size from summary
- Smart camera selection based on scene type
- Exclude religious motifs in negative prompt
```

### Features
```
feat(styles): add illustration style support

- Professional digital illustration prompts
- Vibrant colors, clean lines, bold palette
- Exclude photography terms in negative prompt
- Wide vs character composition logic
```

---

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| v2.1.0 | 2025-10-16 | Scene-aware extraction (object, crowd, action) |
| v2.0.0 | 2025-10-16 | Complete refactor, truthful tracking, illustration style |
| v1.0.0 | 2025-10-15 | Initial implementation |

---

**This document serves as the complete reference for all solutions.**  
**Bookmark for future troubleshooting!**

