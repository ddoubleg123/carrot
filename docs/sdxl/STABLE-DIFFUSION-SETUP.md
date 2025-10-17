# Stable Diffusion Setup on Vast.ai - Working Configuration

## ✅ Successfully Working Setup (October 13, 2025)

This document describes the **working configuration** for running Stable Diffusion on Vast.ai for real AI image generation.

---

## 🖥️ Vast.ai Instance Specifications

### Working GPU Configuration
- **GPU:** RTX 3090 Ti (24GB VRAM)
- **CUDA:** 12.8
- **Disk Space:** 40GB+
- **Location:** Canada (non-China to avoid Hugging Face blocking)
- **Instance ID:** 26749354

### ⚠️ GPUs That DON'T Work
- **RTX 5060 Ti** - Too new (sm_120), not supported by PyTorch 2.5.1 (max sm_90)
- **RTX 50 series** - Generally too new for stable PyTorch versions
- **China-based instances** - Hugging Face model downloads are blocked

### ✅ Recommended GPUs
- RTX 3090 / 3090 Ti (24GB VRAM) - **BEST CHOICE**
- RTX 4090 (24GB VRAM)
- RTX 3080 (10-12GB VRAM) - Minimum for Stable Diffusion

---

## 📦 Installation Steps

### 1. Connect to Vast.ai Instance

```bash
# SSH connection details (example from working instance)
ssh -p 45583 root@171.247.185.4
```

### 2. Install Compatible Dependencies

**Critical:** Use these exact versions to avoid compatibility issues.

```bash
# Install PyTorch with CUDA 12.1 support
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121

# Install Stable Diffusion libraries
pip install diffusers==0.35.1 transformers==4.57.0 accelerate==1.10.1 safetensors==0.6.2

# Install API framework
pip install fastapi==0.119.0 uvicorn==0.37.0 pillow
```

### 3. Create the API Script

Save as `working-sd-api.py`:

```python
#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from diffusers import StableDiffusionPipeline
import base64
from io import BytesIO
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Load model on startup
model_id = "runwayml/stable-diffusion-v1-5"
logger.info(f"Loading model: {model_id}")

try:
    pipe = StableDiffusionPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False
    )
    pipe = pipe.to("cuda")
    logger.info("✅ Model loaded successfully on CUDA")
except Exception as e:
    logger.error(f"❌ Failed to load model: {e}")
    pipe = None

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted"
    num_inference_steps: int = 25
    guidance_scale: float = 7.5

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": pipe is not None,
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/generate")
async def generate(request: GenerateRequest):
    if pipe is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        logger.info(f"Generating image for prompt: {request.prompt[:50]}...")
        
        image = pipe(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale
        ).images[0]
        
        # Convert to base64
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.info("✅ Image generated successfully")
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{img_str}"
        }
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
```

### 4. Start the API

```bash
# Start in background
nohup python3 working-sd-api.py > /tmp/sd-api.log 2>&1 &

# Check if running
ps aux | grep working-sd-api

# View logs
tail -f /tmp/sd-api.log
```

### 5. Verify API is Working

```bash
# Test health endpoint
curl http://localhost:7860/health

# Expected response:
# {"status":"healthy","model_loaded":true,"cuda_available":true}
```

---

## 🔌 Local Connection Setup

### SSH Tunnel (Required for Local Development)

The Vast.ai instance port 7860 is **not publicly accessible**, so you need an SSH tunnel:

```powershell
# Windows PowerShell
ssh -o StrictHostKeyChecking=no -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4
```

**Explanation:**
- `-f` - Run in background
- `-N` - Don't execute remote commands
- `-L 7860:localhost:7860` - Forward local port 7860 to remote port 7860
- `-p 45583` - SSH port (changes per instance)
- `root@171.247.185.4` - Instance IP (changes per instance)

### Verify Tunnel is Working

```powershell
# Test from local machine
Invoke-WebRequest -Uri http://localhost:7860/health -Method GET

# Expected: Status 200 with JSON response
```

---

## ⚙️ Application Configuration

### Environment Variables

**For Local Development (`.env.local`):**
```env
VAST_AI_URL=http://localhost:7860
```

**For Render Deployment:**
```env
VAST_AI_URL=http://171.247.185.4:7860
```

⚠️ **Note:** Direct IP access only works if the Vast.ai instance has public port access. For local development, always use the SSH tunnel.

### Code Integration

In `carrot/src/lib/media/aiImageGenerator.ts`:

```typescript
async function generateImageWithStableDiffusion(prompt: string): Promise<string | null> {
  try {
    // Use Vast.ai Stable Diffusion API via SSH tunnel
    const vastAiUrl = process.env.VAST_AI_URL || 'http://localhost:7860'
    
    const response = await fetch(`${vastAiUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: "blurry, low quality, distorted, text, watermark, signature, logo",
        num_inference_steps: 25,
        guidance_scale: 7.5
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    })

    if (!response.ok) {
      throw new Error(`Stable Diffusion API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.success || !data.image) {
      throw new Error('No image returned from Stable Diffusion API')
    }

    // Our API returns the image as a data URL already
    const imageUrl = data.image
    console.log('[AI Image Generator] ✅ Successfully generated image with Stable Diffusion')
    return imageUrl
    
  } catch (error) {
    console.error('[AI Image Generator] Stable Diffusion error:', error)
    return null
  }
}
```

---

## 🧪 Testing

### Test Image Generation

```bash
# On the Vast.ai instance
python3 -c "import requests; r = requests.post('http://localhost:7860/generate', json={'prompt': 'basketball player', 'num_inference_steps': 20}); print(r.status_code); print('Image length:', len(r.json()['image']))"

# Expected output:
# 200
# Image length: 678418
```

### Test from Application

1. Start the dev server: `npm run dev` (in the `carrot` directory)
2. Navigate to: `http://localhost:3005/test-deepseek-images`
3. Click "Generate Image" for "Derrick Rose"
4. You should see a real AI-generated image (base64 PNG)

**Success indicators:**
- Response contains `data:image/png;base64,iVBORw0KGgo...`
- Source is `'ai-generated'`
- No Wikimedia fallback URL

---

## 🔧 Troubleshooting

### Issue: Connection Timeout

**Symptom:**
```
[AI Image Generator] Stable Diffusion error: TypeError: fetch failed
[cause]: [Error [ConnectTimeoutError]: Connect Timeout Error]
```

**Solution:**
1. Check if SSH tunnel is running: `Get-Process | Where-Object {$_.Name -eq "ssh"}`
2. Restart tunnel if needed
3. Verify API is running on Vast.ai: `ssh -p 45583 root@171.247.185.4 "curl http://localhost:7860/health"`

### Issue: Model Not Loading

**Symptom:**
```
{"status":"healthy","model_loaded":false,"cuda_available":true}
```

**Solution:**
1. Check logs: `tail -f /tmp/sd-api.log`
2. Verify GPU compatibility (no RTX 50 series)
3. Check disk space: `df -h`
4. Restart API

### Issue: CUDA Error

**Symptom:**
```
CUDA error: no kernel image is available for execution on the device
```

**Solution:**
- Your GPU is too new for the PyTorch version
- Switch to RTX 3090/4090 or older compatible GPU
- **DO NOT** use RTX 50 series

### Issue: Model Download Fails

**Symptom:**
```
OSError: Cannot load model runwayml/stable-diffusion-v1-5: model is not cached locally
```

**Solution:**
- Instance is likely in China (Hugging Face blocked)
- Switch to a non-China region (US, Canada, Europe)

---

## 📊 Performance

### Generation Times
- **RTX 3090 Ti:** ~5-10 seconds per image (25 steps)
- **Image Size:** ~500-700KB (base64 encoded)
- **Resolution:** 512x512 (default)

### Cost Estimates (Vast.ai)
- **RTX 3090 Ti:** ~$0.30-0.50/hour
- **Monthly (24/7):** ~$220-360/month
- **Recommended:** Use on-demand, not 24/7

---

## 🔐 Security Notes

1. **SSH Tunnel:** Keep the tunnel process running for local development
2. **Environment Variables:** Never commit `.env.local` to git
3. **API Access:** The API has no authentication - only use through SSH tunnel locally
4. **Vast.ai Keys:** Keep SSH keys secure

---

## 📝 Quick Reference

### Start Everything

```bash
# 1. SSH Tunnel (local machine)
ssh -o StrictHostKeyChecking=no -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4

# 2. Verify API (local machine)
Invoke-WebRequest -Uri http://localhost:7860/health

# 3. Start dev server (local machine)
cd carrot
npm run dev
```

### Stop Everything

```bash
# Kill SSH tunnel
Get-Process | Where-Object {$_.Name -eq "ssh"} | Stop-Process

# Stop API on Vast.ai
ssh -p 45583 root@171.247.185.4 "pkill -f working-sd-api"
```

---

## ✅ Success Checklist

- [ ] Vast.ai instance with RTX 3090/4090 (not RTX 50 series)
- [ ] Instance in non-China region
- [ ] PyTorch 2.5.1 + CUDA 12.1 installed
- [ ] Diffusers, transformers, accelerate installed
- [ ] API script running on port 7860
- [ ] SSH tunnel active on local machine
- [ ] `VAST_AI_URL=http://localhost:7860` in `.env.local`
- [ ] Health check returns `model_loaded: true`
- [ ] Test image generation returns base64 PNG
- [ ] Application generates real AI images (no Wikimedia fallback)

---

## 🎉 Final Result

**Working API Response:**
```json
{
  "success": true,
  "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAA...",
  "source": "ai-generated",
  "license": "generated",
  "prompt": "Create a dynamic basketball hero image featuring Derrick Rose..."
}
```

**You now have a fully functional Stable Diffusion image generation system!** 🚀🎨

