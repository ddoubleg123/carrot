# Animation (Cartoon/Anime Style) - Complete Documentation

**Added:** 2025-10-16  
**Status:** ✅ Complete

---

## Overview

The **Animation (Cartoon/Anime Style)** creates vibrant, energetic images with anime/cartoon aesthetics. Features cel-shading, high contrast, dynamic poses, and expressive character designs typical of Japanese animation and Western cartoons.

---

## Key Characteristics

### ✅ Positive Prompt Elements
- **Anime style & cartoon animation**
- **Vibrant colors & high contrast**
- **Cel-shaded rendering**
- **Dynamic character design**
- **Bright colors & expressive poses**
- **Energetic & colorful aesthetic**

### ❌ Negative Prompt Exclusions
- **All photography:** photograph, photorealistic, realistic, lifelike, natural, authentic
- **Documentary elements:** journalistic, candid, snapshot
- **3D rendering:** 3D render, CGI, realistic rendering
- **Religious motifs:** halo, crown of thorns, stained glass, saint iconography

---

## Composition Logic

### Wide Scene (with context - action/crowd/location)
```
dynamic wide-angle anime composition, action scene, detailed anime background, crowd of characters
```

### Character Portrait (no context)
```
anime character portrait, centered character design, expressive face, dynamic pose
```

---

## Example Outputs

### Example 1: Jesus Christ Feeding Scene (Wide Anime)

**Input:**
```json
{
  "title": "Jesus Christ",
  "summary": "Jesus Christ feeding 100 people with fish",
  "artisticStyle": "animation"
}
```

**Generated Prompt:**
```
Jesus Christ is clearly visible, feeding, holding or distributing fish, surrounded by 100 people, anime style, cartoon animation, vibrant colors, cel-shaded, dynamic character design, high contrast, bright colors, expressive poses, energetic, colorful, anime art style, dynamic wide-angle anime composition, action scene, detailed anime background, crowd of characters, professional quality, perfect composition, rule of thirds
```

**Negative Prompt:**
```
photograph, photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, 3d render, cgi, realistic rendering, lowres, blurry, pixelated, distorted, deformed, bad anatomy, duplicate people, text artifacts, halo, crown of thorns, stained glass, mural, religious iconography, saint iconography
```

---

### Example 2: Derrick Rose Character Portrait

**Input:**
```json
{
  "title": "Derrick Rose",
  "summary": "Portrait of Derrick Rose",
  "artisticStyle": "animation"
}
```

**Generated Prompt:**
```
Derrick Rose is clearly visible, anime style, cartoon animation, vibrant colors, cel-shaded, dynamic character design, high contrast, bright colors, expressive poses, energetic, colorful, anime art style, anime character portrait, centered character design, expressive face, dynamic pose, professional quality, perfect composition, rule of thirds
```

---

### Example 3: Dual Subject Anime (Trump & Putin Rally)

**Input:**
```json
{
  "title": "Donald Trump",
  "summary": "Donald Trump in a large arena with Vladimir Putin celebrating",
  "artisticStyle": "animation"
}
```

**Generated Prompt:**
```
Both Donald Trump and Vladimir Putin are clearly visible, in a large arena, with landscape details visible, anime style, cartoon animation, vibrant colors, cel-shaded, dynamic character design, high contrast, bright colors, expressive poses, energetic, colorful, anime art style, dynamic wide-angle anime composition, action scene, detailed anime background, crowd of characters, professional quality, perfect composition, rule of thirds
```

---

## Style Characteristics

### Visual Style
- **Cel-shaded coloring** (flat color blocks with defined edges)
- **High contrast** (bright highlights, deep shadows)
- **Vibrant color palette** (saturated, eye-catching colors)
- **Expressive character designs** (large eyes, dynamic expressions)
- **Clean line work** (defined outlines)

### Composition
- **Dynamic angles** and perspectives
- **Expressive poses** (action-oriented)
- **Detailed backgrounds** (for scenes)
- **Character-focused** framing

### Technical Quality
- **Professional animation quality**
- **High-quality anime art**
- **Detailed character design**
- **Perfect composition**

---

## Comparison: Photorealistic vs Illustration vs Animation

| Aspect | Photorealistic | Illustration | Animation |
|--------|---------------|--------------|-----------|
| **Style** | Natural photo | Stylized art | Anime/cartoon |
| **Colors** | Natural tones | Bold palette | Vibrant, high contrast |
| **Shading** | Realistic gradients | Artistic | Cel-shaded, flat blocks |
| **Lines** | Soft, realistic | Clean, defined | Strong outlines |
| **Expressions** | Natural | Creative | Expressive, exaggerated |
| **Negative** | Excludes art | Excludes photos | Excludes photos & 3D |
| **Background** | Realistic depth | Stylized | Detailed anime style |

---

## Test Cases

### Test 1: Anime Elements Present
```typescript
test('animation style: anime elements, no photo terms', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ feeding 100 people with fish');
  const { positive, negative } = buildPrompt({ s, styleOverride: 'animation' });
  
  expect(positive).toMatch(/anime/i);
  expect(positive).toMatch(/cel-shaded/i);
  expect(positive).toMatch(/vibrant colors/i);
  expect(positive).toMatch(/cartoon animation/i);
});
```

### Test 2: No Photo Terms
```typescript
test('animation: excludes realistic photo elements', () => {
  const { positive } = buildPrompt({ s, styleOverride: 'animation' });
  
  expect(positive).not.toMatch(/photorealistic/i);
  expect(positive).not.toMatch(/lens/i);
  expect(positive).not.toMatch(/camera/i);
  expect(positive).not.toMatch(/f\/1.4/i);
});
```

### Test 3: Excludes 3D in Negative
```typescript
test('animation: negative excludes 3D and CGI', () => {
  const { negative } = buildPrompt({ s, styleOverride: 'animation' });
  
  expect(negative).toMatch(/3d render/i);
  expect(negative).toMatch(/cgi/i);
  expect(negative).toMatch(/realistic rendering/i);
});
```

### Test 4: Scene-Aware Composition
```typescript
test('animation: wide scene for crowds', () => {
  const s = sanitizeInputs('Person', 'Person at a rally with 100 people');
  const { positive } = buildPrompt({ s, styleOverride: 'animation' });
  
  expect(positive).toMatch(/dynamic wide-angle anime composition/i);
  expect(positive).toMatch(/crowd of characters/i);
});

test('animation: character portrait for individuals', () => {
  const s = sanitizeInputs('Person', 'Portrait of Person');
  const { positive } = buildPrompt({ s, styleOverride: 'animation' });
  
  expect(positive).toMatch(/anime character portrait/i);
  expect(positive).toMatch(/centered character design/i);
});
```

---

## When to Use Animation Style

### Best For:
- ✅ **Character-focused images** (expressive, dynamic)
- ✅ **Action scenes** (sports, battles, dramatic moments)
- ✅ **Colorful subjects** (bright, energetic content)
- ✅ **Stylized interpretations** (non-realistic rendering)
- ✅ **Youth-oriented content** (fun, vibrant, engaging)

### Avoid For:
- ❌ Professional/business contexts (use photorealistic)
- ❌ Documentary content (use photorealistic)
- ❌ Subtle/minimalist designs (use minimalist style)
- ❌ Classical art contexts (use painting/oil painting)

---

## API Usage

### Request
```bash
curl -X POST http://localhost:3005/api/ai/generate-hero-image \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Derrick Rose",
    "summary": "Derrick Rose dunking basketball",
    "artisticStyle": "animation",
    "seed": 12345,
    "enableHiresFix": false
  }'
```

### Response
```json
{
  "success": true,
  "imageUrl": "data:image/png;base64,...",
  "prompt": "Derrick Rose is clearly visible, anime style, cartoon animation, vibrant colors, cel-shaded...",
  "featuresApplied": {
    "Model": "SDXL",
    "Refiner": "❌",
    "Face Restoration": "✅",
    "Hires Fix": "❌",
    "Upscaler": "✅"
  }
}
```

---

## Console Log Example

```
[GenerateHeroImage] Sanitized: {
  names: ['Jesus Christ'],
  mode: 'single',
  actionHint: 'feeding',
  objectHint: 'fish',
  countHint: '100 people'
}
[GenerateHeroImage] Built prompt: Jesus Christ is clearly visible, feeding, holding or distributing fish, surrounded by 100 people, anime style, cartoon animation, vibrant colors, cel-shaded, dynamic character design, high contrast, bright colors, expressive poses, energetic, colorful, anime art style, dynamic wide-angle anime composition, action scene, detailed anime background, crowd of characters, professional quality, perfect composition, rule of thirds

[AI Image Generator] ✅ Successfully generated image with SDXL
[AI Image Generator] Features applied:
   - Model: SDXL
   - Refiner: ✅
   - Face Restoration: ✅
   - Hires Fix: ❌
   - Upscaler: ✅
   - Resolution: 1024x1024
   - Generation Time: 16433ms
```

---

## Files Modified

1. ✅ `src/lib/prompt/build.ts` - Added animation case
2. ✅ `tests/prompt.spec.ts` - Added animation tests
3. ✅ `docs/ANIMATION-STYLE.md` - Complete documentation

---

## Acceptance Criteria ✅

- ✅ Positive includes: anime, cel-shaded, vibrant colors, cartoon animation
- ✅ Positive excludes: photorealistic, camera, lens, f-stop
- ✅ Negative excludes: photography, 3D render, CGI, realistic rendering
- ✅ Wide scenes use "dynamic wide-angle anime composition"
- ✅ Portraits use "anime character portrait, expressive face"
- ✅ Tests pass

---

## How to Test

1. **Visit:** `http://localhost:3005/test-deepseek-images`
2. **Select:** 🎬 Animation (Cartoon/Anime Style)
3. **Enter test data:**
   - Title: `Jesus Christ`
   - Summary: `Jesus Christ feeding 100 people with fish`
4. **Generate image**
5. **Verify console logs:**
   - ✅ Prompt has "anime", "cel-shaded", "vibrant colors"
   - ✅ Prompt does NOT have "photorealistic", "lens", "camera"
   - ✅ Negative has "photograph", "3d render", "cgi"

---

## Expected Visual Output

### Style Elements:
- **Cel-shaded coloring** - Flat color blocks
- **Strong outlines** - Black or dark lines defining shapes
- **Vibrant palette** - Bright, saturated colors
- **Expressive faces** - Large eyes, dynamic expressions
- **Dynamic poses** - Action-oriented character positioning
- **Detailed backgrounds** - Anime-style environmental details

---

## Next Steps

✅ **Animation style complete!**

**Progress:** 3/10 styles done
- ✅ Hyper-Realistic (Photorealistic)
- ✅ Illustration (Stylized Art)  
- ✅ Animation (Cartoon/Anime Style)

**Remaining:** 7 styles
- ⏳ Painting, Digital Art, Sketch, Watercolor, Oil Painting, Minimalist, Vintage

---

**Ready to test the Animation style!** 🎬✨

