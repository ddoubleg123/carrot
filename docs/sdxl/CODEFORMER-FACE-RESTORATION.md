# 👤 CodeFormer Face Restoration Guide

## Overview

CodeFormer is an advanced AI model that restores and enhances facial details in generated images. It improves eyes, lips, skin texture, and overall facial quality while maintaining natural appearance.

---

## What is CodeFormer?

**CodeFormer** is a robust face restoration algorithm that:
- Detects faces automatically
- Restores fine facial details (eyes, lips, skin pores)
- Enhances facial features while maintaining identity
- Works on multiple faces in one image
- Balances between quality enhancement and fidelity preservation

**When to Use:**
- Portrait photography
- Headshots
- Social media profile pictures
- Character art with faces
- Any image where facial quality is critical

---

## Implementation Details

### Architecture

The implementation uses the proper CodeFormer architecture:

```python
from basicsr.archs.codeformer_arch import CodeFormer
from facelib.utils.face_restoration_helper import FaceRestoreHelper
```

**Components:**
1. **CodeFormer Model** - Neural network for face restoration
   - `dim_embd=512` - Embedding dimension
   - `codebook_size=1024` - Codebook size for vector quantization
   - `n_head=8` - Number of attention heads
   - `n_layers=9` - Number of transformer layers

2. **Face Restoration Helper** - Face detection and processing
   - Detects faces using RetinaFace
   - Aligns and crops faces
   - Pastes restored faces back to original image

### Process Flow

1. **Face Detection**
   - Automatically detects all faces in image
   - Extracts facial landmarks (eyes, nose, mouth)
   - Aligns faces to canonical pose

2. **Face Restoration**
   - Processes each face individually
   - Applies CodeFormer neural network
   - Enhances details based on weight parameter

3. **Face Pasting**
   - Seamlessly pastes restored faces back
   - Blends edges for natural appearance
   - Preserves background and composition

---

## API Parameters

### Request Parameters

```python
{
  "prompt": "your prompt",
  "use_face_restoration": True,      # Enable face restoration
  "face_restoration_weight": 0.6     # Fidelity weight (0.0-1.0)
}
```

### `use_face_restoration` (bool)
- **Default:** `true`
- **Description:** Enable/disable face restoration
- **When to disable:** Non-face images, abstract art, when speed is priority

### `face_restoration_weight` (float)
- **Range:** 0.0 to 1.0
- **Default:** 0.6
- **Description:** Balance between quality and fidelity

**Weight Guidelines:**
- **0.0-0.3:** More creative, higher quality, less faithful to original
- **0.4-0.6:** Balanced (recommended)
- **0.7-1.0:** More faithful to original, preserves features better

---

## Usage Examples

### Basic Usage

**cURL:**
```bash
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional portrait photo, detailed face",
    "use_face_restoration": true,
    "face_restoration_weight": 0.6
  }'
```

**Python:**
```python
import requests

response = requests.post("http://localhost:7860/generate", json={
    "prompt": "professional headshot, sharp eyes, natural skin",
    "use_face_restoration": True,
    "face_restoration_weight": 0.6
})

result = response.json()
print(f"Face restoration applied: {result['face_restoration_applied']}")
```

### Combined with Hires Fix

For **maximum quality** portraits:

```python
response = requests.post("http://localhost:7860/generate", json={
    "prompt": "professional portrait, detailed facial features",
    "hires_fix": True,              # Two-pass upscaling
    "use_face_restoration": True,   # Face enhancement
    "face_restoration_weight": 0.6,
    "seed": 42
})

# Result: 1536x1536 with enhanced facial details
```

### Different Weight Values

**Creative (weight=0.3):**
```python
{
  "prompt": "artistic portrait",
  "use_face_restoration": True,
  "face_restoration_weight": 0.3  # More enhancement, less fidelity
}
```

**Balanced (weight=0.6):** ⭐ Recommended
```python
{
  "prompt": "professional headshot",
  "use_face_restoration": True,
  "face_restoration_weight": 0.6  # Best balance
}
```

**Faithful (weight=0.9):**
```python
{
  "prompt": "portrait photography",
  "use_face_restoration": True,
  "face_restoration_weight": 0.9  # Preserves original features
}
```

---

## Performance

### Timing

| Scenario | Time | Notes |
|----------|------|-------|
| Standard generation (no faces) | ~12s | No face detection overhead |
| With face restoration (1 face) | ~15s | +3s for face processing |
| With face restoration (multiple) | ~15-20s | Depends on face count |
| Hires Fix + Face Restoration | ~28s | Both enhancements combined |

### VRAM Usage

- Face detection: ~1GB
- Face restoration per face: ~0.5GB
- **Total additional:** ~2GB VRAM
- **Recommended:** 20GB+ VRAM (RTX 3090/4090)

---

## Quality Improvements

### What Gets Enhanced

✅ **Eyes:**
- Sharper pupils and iris details
- Better eyelash definition
- More realistic eye highlights

✅ **Skin:**
- Natural skin texture
- Reduced blurriness
- Better pore details
- More realistic complexion

✅ **Lips:**
- Sharper lip edges
- Better color and texture
- More natural appearance

✅ **Overall Face:**
- Sharper facial features
- Better symmetry
- More photorealistic
- Enhanced details without artifacts

### Before/After Comparison

**Without Face Restoration:**
- Slightly soft facial features
- Less defined eyes
- Smooth but less detailed skin
- Good but not photorealistic

**With Face Restoration:**
- Crystal clear facial features ⭐
- Sharp, defined eyes with catchlights
- Realistic skin texture
- Photorealistic quality

---

## Best Practices

### Prompt Engineering

**Good prompts for face restoration:**
```
"professional portrait photo, detailed face, sharp eyes, natural skin"
"high quality headshot, 8k, detailed facial features"
"photorealistic portrait, professional photography"
```

**Keywords to include:**
- "professional portrait"
- "detailed face" / "detailed facial features"
- "sharp eyes"
- "natural skin" / "realistic skin texture"
- "high quality" / "8k" / "professional photography"

### When to Use Face Restoration

✅ **Use for:**
- Portrait photography
- Headshots
- Profile pictures
- Character art
- Social media content
- Professional photography
- Client deliverables

❌ **Skip for:**
- Landscapes (no faces)
- Abstract art
- Non-human subjects
- When speed is critical
- Concept iterations/previews

### Weight Selection Guide

| Use Case | Recommended Weight | Why |
|----------|-------------------|-----|
| Professional headshots | 0.5-0.6 | Balance of quality and fidelity |
| Artistic portraits | 0.3-0.4 | More creative freedom |
| Photo restoration | 0.7-0.9 | Preserve original features |
| Social media | 0.5-0.7 | Natural but enhanced |
| High-end photography | 0.6-0.7 | Professional quality |

---

## Troubleshooting

### Issue: No Faces Detected

**Symptom:** "No faces detected" in logs

**Causes:**
- Face not visible or very small
- Face heavily occluded
- Extreme angles
- Non-human faces

**Solutions:**
1. Ensure face is clearly visible in composition
2. Use prompts that center the face
3. Generate at higher resolution first
4. Check if prompt specifies faces

### Issue: Face Looks Artificial

**Symptom:** Restored face looks fake or overdone

**Solutions:**
1. Increase weight to 0.7-0.9 (more faithful)
2. Adjust prompt to be more natural
3. Use with refiner for better base quality
4. Try different seeds

### Issue: Face Restoration Slow

**Symptom:** Takes > 30 seconds total

**Solutions:**
1. Check VRAM usage (`nvidia-smi`)
2. Reduce resolution if using Hires Fix
3. Disable for preview generations
4. Ensure no other GPU processes running

### Issue: Faces Not Improved

**Symptom:** No visible improvement

**Possible causes:**
1. Base image already has good faces
2. Weight too high (> 0.9)
3. CodeFormer model not loaded properly

**Solutions:**
1. Check logs for "CodeFormer loaded successfully"
2. Try weight=0.5 for more visible enhancement
3. Compare before/after carefully (zoom in)

---

## Technical Notes

### Model Loading

CodeFormer loads on startup:
```
🚀 Loading CodeFormer model...
   Loaded weights from /root/CodeFormer/weights/CodeFormer/codeformer.pth
✅ CodeFormer loaded successfully
```

**Model weights location:**
```
/root/CodeFormer/weights/CodeFormer/codeformer.pth
```

### Dependencies

Required Python packages:
```
basicsr
facelib
torch
opencv-python
```

### Face Detection Model

Uses **RetinaFace ResNet50** for detection:
- Robust face detection
- Handles multiple faces
- Works on various angles and lighting
- Fast and accurate

---

## Integration Examples

### Frontend Integration

**React Component:**
```javascript
const [faceRestoration, setFaceRestoration] = useState(true);
const [restorationWeight, setRestorationWeight] = useState(0.6);

const generateImage = async () => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: userPrompt,
      use_face_restoration: faceRestoration,
      face_restoration_weight: restorationWeight
    })
  });
  
  const result = await response.json();
  if (result.face_restoration_applied) {
    console.log('✅ Faces enhanced!');
  }
};
```

**UI Controls:**
```jsx
<label>
  <input
    type="checkbox"
    checked={faceRestoration}
    onChange={(e) => setFaceRestoration(e.target.checked)}
  />
  Enhance Faces
</label>

<label>
  Fidelity: {restorationWeight.toFixed(1)}
  <input
    type="range"
    min="0"
    max="1"
    step="0.1"
    value={restorationWeight}
    onChange={(e) => setRestorationWeight(parseFloat(e.target.value))}
  />
</label>
```

### Backend API Wrapper

```python
def generate_portrait(prompt: str, enhance_face: bool = True):
    """Generate portrait with optional face enhancement"""
    
    payload = {
        "prompt": f"{prompt}, professional portrait, detailed face",
        "use_face_restoration": enhance_face,
        "face_restoration_weight": 0.6,
        "num_inference_steps": 30
    }
    
    response = requests.post("http://localhost:7860/generate", json=payload)
    return response.json()

# Usage
result = generate_portrait("businessman in suit", enhance_face=True)
```

---

## Testing

### Run Test Suite

```bash
python test-hires-fix.py
```

This will generate:
- `output_face_restoration.png` - With face restoration
- `output_best_quality.png` - Hires Fix + Face Restoration

### Manual Testing

**Test 1: Basic Face Restoration**
```bash
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional portrait photo of a person",
    "use_face_restoration": true,
    "seed": 42
  }'
```

**Test 2: Weight Comparison**
Generate same image with different weights:
- weight=0.3 (creative)
- weight=0.6 (balanced)
- weight=0.9 (faithful)

Compare the results!

---

## FAQ

### Q: Does it work on all faces?

A: Works best on:
- Human faces
- Front-facing or slight angles
- Visible facial features
- Adequate resolution (512px+ recommended)

May not work well on:
- Very small faces (< 100px)
- Extreme angles
- Heavily occluded faces
- Non-human faces

### Q: Can I use it without Hires Fix?

A: Yes! Face restoration works independently:
```python
{
  "prompt": "portrait",
  "width": 1024,
  "height": 1024,
  "use_face_restoration": True,  # Face restoration only
  "hires_fix": False  # No hires fix
}
```

### Q: How many faces can it process?

A: No hard limit. Processes all detected faces:
- 1 face: ~3s overhead
- 2-3 faces: ~5s overhead
- 4+ faces: May slow down significantly

### Q: Does it increase file size?

A: Slightly. Enhanced details may result in:
- 10-20% larger PNG files
- Better compression with JPEG
- More detail = more data

### Q: Can I adjust other parameters?

A: Advanced parameters (in code):
- `upscale_factor` - Face upscaling (default: 1)
- `face_size` - Processing resolution (default: 512)
- `det_model` - Detection model (default: retinaface_resnet50)

Contact developer to expose these via API.

---

## Summary

✅ **Implemented:**
- Proper CodeFormer architecture integration
- Automatic face detection
- Multiple face support
- Configurable fidelity weight
- Production-ready error handling

✅ **Benefits:**
- Significantly better facial details
- Natural appearance
- Professional quality
- Works with Hires Fix
- Minimal performance impact

✅ **Performance:**
- ~3s overhead per face
- ~2GB additional VRAM
- Automatic and seamless
- Optional (can be disabled)

---

## Quick Reference

**Enable face restoration:**
```json
{
  "prompt": "portrait photo",
  "use_face_restoration": true,
  "face_restoration_weight": 0.6
}
```

**Best quality (Hires Fix + Face Restoration):**
```json
{
  "prompt": "professional headshot",
  "hires_fix": true,
  "use_face_restoration": true,
  "face_restoration_weight": 0.6
}
```

**Result:** Photorealistic 1536x1536 portrait with enhanced facial details!

---

**Last Updated:** October 13, 2025
**Status:** ✅ Production Ready
**Integration:** Complete
**Testing:** Available (`test-hires-fix.py`)

**Ready to use!** 👤✨

