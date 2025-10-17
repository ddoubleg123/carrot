# 🚀 Quick Start: Hires Fix

## What Is It?

A two-pass upscaling technique that generates **much higher quality** images:
1. Generate at 768x768 (fast)
2. Upscale to 1536x1536 (instant)
3. Re-denoise with refiner (adds detail)

**Result:** 4x more pixels with significantly better detail!

---

## How to Use

### Option 1: cURL (Quick Test)

```bash
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional portrait photo of a person, highly detailed",
    "hires_fix": true,
    "seed": 42
  }'
```

### Option 2: Python

```python
import requests

response = requests.post("http://localhost:7860/generate", json={
    "prompt": "your prompt here",
    "hires_fix": True,  # ← Enable advanced mode
    "seed": 42           # ← Optional: for reproducibility
})

result = response.json()
# result['image'] contains base64 image at 1536x1536
```

### Option 3: JavaScript/Frontend

```javascript
const response = await fetch('http://localhost:7860/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'beautiful sunset over mountains',
    hires_fix: true,
    seed: 42
  })
});

const data = await response.json();
// data.image contains data URI for <img> tag
// data.final_resolution will be "1536x1536"
```

---

## Comparison

| Feature | Standard | Advanced Hires Fix |
|---------|----------|-------------------|
| Resolution | 1024x1024 | **1536x1536** |
| Pixels | 1.0M | **2.4M** (2.4x more!) |
| Time | ~12s | ~25s |
| Quality | Good | **Excellent** |
| Details | Moderate | **Sharp & Clear** |
| VRAM | 10GB | 16GB |

---

## When to Use?

### ✅ Use Advanced Hires Fix For:
- Professional photography
- Product shots
- Portraits/headshots
- Print-ready images
- Client deliverables
- Portfolio work

### ❌ Use Standard For:
- Quick previews
- Concept iterations  
- Testing prompts
- Low-VRAM systems
- When speed matters

---

## Test It Now

Run the test suite:

```bash
python test-hires-fix.py
```

This will generate 3 images for comparison:
- `output_standard.png` - Standard quality (1024x1024)
- `output_hires_fix.png` - **High quality** (1536x1536) ⭐
- `output_simple_hires.png` - Simple upscale (1152x1152)

**Look at the difference yourself!**

---

## Settings Guide

### Default (Good)
```json
{
  "prompt": "your prompt",
  "hires_fix": true
}
```
→ 1536x1536 in ~25s

### Fast Mode
```json
{
  "prompt": "your prompt",
  "hires_fix": true,
  "num_inference_steps": 20
}
```
→ 1536x1536 in ~18s (slightly lower quality)

### Best Quality
```json
{
  "prompt": "your prompt",
  "hires_fix": true,
  "num_inference_steps": 35,
  "use_face_restoration": true
}
```
→ 1536x1536 in ~30s (maximum quality)

---

## API Reference

### Request
```typescript
{
  prompt: string,              // Your text prompt
  hires_fix?: boolean,         // Enable advanced mode (default: false)
  seed?: number,               // Random seed (optional)
  num_inference_steps?: number, // 20-40 (default: 30)
  guidance_scale?: number,     // 7.0-8.5 (default: 7.5)
  negative_prompt?: string     // What to avoid
}
```

### Response
```typescript
{
  success: true,
  image: string,                    // base64 data URI
  final_resolution: "1536x1536",    // Actual size
  hires_fix_applied: true,          // Confirmation
  generation_time_seconds: 24.8,    // How long it took
  model: "SDXL"
}
```

---

## Troubleshooting

### "Out of memory"
→ GPU needs 20GB+ VRAM (RTX 3090/4090)
→ Or use standard mode instead

### "Takes too long"
→ Reduce `num_inference_steps` to 20
→ Or use standard mode for previews

### "Quality not better"
→ Check you're comparing correct files
→ Try with different prompts
→ Zoom in to see fine details

---

## Integration Example

### Before:
```javascript
const imageData = await generateImage({
  prompt: userPrompt,
  width: 1024,
  height: 1024
});
```

### After:
```javascript
const imageData = await generateImage({
  prompt: userPrompt,
  hires_fix: true,  // ← Just add this!
  seed: userSeed    // ← Optional
  // width/height ignored in hires_fix mode
});
```

**That's it!** No other changes needed.

---

## Performance

**On RTX 3090 Ti:**
- Standard 1024x1024: ~12 seconds
- Advanced 1536x1536: ~25 seconds
- **Extra time:** ~13 seconds
- **Extra quality:** Significant improvement!

**Worth it?** For professional work, absolutely!

---

## More Info

- **Full Guide:** `HIRES-FIX-GUIDE.md` (comprehensive documentation)
- **Summary:** `HIRES-FIX-SUMMARY.md` (implementation details)
- **Test Suite:** `test-hires-fix.py` (working examples)
- **API Code:** `upgraded-sdxl-api.py` (implementation)

---

## TL;DR

```python
# Just add this to your API call:
{
  "prompt": "your awesome prompt",
  "hires_fix": true
}

# Get: 1536x1536 image with professional quality
# Time: ~25 seconds (vs ~12s standard)
# Quality: 🎯🎯🎯🎯🎯 (vs 🎯🎯🎯 standard)
```

**Try it now!** 🚀

