# Testing the Upgraded SDXL API

## 🚀 Step 1: Start the API on Vast.ai

### Option A: Direct SSH (Recommended)
```bash
ssh -p 45583 root@171.247.185.4
cd /root
python3 upgraded-sdxl-api.py
```

### Option B: Upload and run the start script
```bash
# From local machine - upload the script
scp -P 45583 start-upgraded-sdxl.sh root@171.247.185.4:/root/

# SSH in and run it
ssh -p 45583 root@171.247.185.4
chmod +x /root/start-upgraded-sdxl.sh
./start-upgraded-sdxl.sh
```

## ⏳ Step 2: Wait for Models to Download (First Time Only)

The API will download these models on first run:
- **SDXL Base**: ~7GB (15-20 minutes)
- **SDXL Refiner**: ~7GB (15-20 minutes)  
- **VAE**: ~350MB (2-3 minutes)
- **Total**: ~15GB, 30-40 minutes

You'll see progress like this:
```
🚀 Loading SDXL Base model (stabilityai/stable-diffusion-xl-base-1.0)...
   This may take 15-20 minutes on first run (downloading ~7GB)
   ☕ Grab a coffee... Models will be cached for future use.
```

**After first download, models are cached - future startups take seconds!**

## 🧪 Step 3: Test the Health Endpoint

### From Local Machine (with SSH tunnel):
```powershell
# Start the SSH tunnel first
.\start-vast-tunnel.ps1

# Then test the health endpoint
curl http://localhost:7860/health
```

Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "cuda_available": true,
  "codeformer_available": true,
  "realesrgan_available": true,
  "vram_available": "12.5GB / 24.0GB"
}
```

### From Vast.ai Server (direct):
```bash
curl http://localhost:7860/health
```

## 🎨 Step 4: Test Image Generation

### Test from Command Line:
```bash
# Create a test request
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional headshot of a business executive, sharp focus, 8k",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 25,
    "use_refiner": true,
    "use_face_restoration": true,
    "hires_fix": false
  }'
```

### Test from Frontend:
1. Make sure the SSH tunnel is running: `.\start-vast-tunnel.ps1`
2. Start the Next.js dev server: `cd carrot && npm run dev`
3. Navigate to: http://localhost:3005/test-deepseek-images
4. Click **"Generate Image"**
5. Watch the magic happen! 🎉

## 📊 Understanding the Generation Options

### Basic Parameters:
- `width`/`height`: 512, 768, or 1024 pixels
- `num_inference_steps`: 20-30 (higher = better quality, slower)
- `guidance_scale`: 7.5 (higher = follows prompt more strictly)

### Advanced Features:
- `use_refiner`: true (adds extra detail pass)
- `use_face_restoration`: true (enables CodeFormer for crisp faces)
- `face_restoration_weight`: 0.6 (0.0-1.0, higher = more faithful to original)
- `use_realesrgan`: true (neural upscaling vs LANCZOS)

### Hires Fix Options:
- `hires_fix`: false (simple upscale - legacy)
- `hires_fix_simple`: false (two-pass: 768→1536 with re-denoise - BEST QUALITY)

## 🎯 Recommended Settings for Best Face Quality

```json
{
  "prompt": "professional portrait, sharp detailed face, 8k, photorealistic",
  "width": 1024,
  "height": 1024,
  "num_inference_steps": 30,
  "guidance_scale": 7.5,
  "use_refiner": true,
  "use_face_restoration": true,
  "face_restoration_weight": 0.6,
  "hires_fix": true,
  "use_realesrgan": true
}
```

This will:
1. Generate 768x768 base image
2. Upscale to 1536x1536 with RealESRGAN neural network
3. Re-denoise with refiner for added detail
4. Apply CodeFormer face restoration
5. Result: **Crisp, photorealistic faces at 1536x1536!**

## 🐛 Troubleshooting

### API not responding?
```bash
# Check if process is running
ps aux | grep python

# Check API logs
tail -f /var/log/sdxl-api.log  # if you set up logging

# Or just restart it
pkill python3
python3 /root/upgraded-sdxl-api.py
```

### SSH tunnel not working?
```powershell
# Kill existing tunnels
Get-Process | Where-Object {$_.ProcessName -eq "ssh"} | Stop-Process -Force

# Restart tunnel
.\start-vast-tunnel.ps1
```

### Models not downloading?
```bash
# Check disk space
df -h

# Check internet connection
ping huggingface.co

# Check if models exist
ls -lh ~/.cache/huggingface/hub/
```

### Out of memory?
- Reduce resolution: Use 768x768 instead of 1024x1024
- Disable refiner: `"use_refiner": false`
- Disable hires fix: `"hires_fix": false`

## 📝 Monitoring API Performance

Watch the logs to see generation details:
```
🎨 New generation request
   Prompt: professional headshot...
   Resolution: 1024x1024
   Steps: 30
   Refiner: True
   Hires Fix: True (Advanced)
   
✅ Base image generated in 12.3s
🔧 Upscaling with RealESRGAN (2x)...
   ✅ Neural upscaling: (768, 768) → (1536, 1536)
✅ Refinement completed in 8.7s
✅ Hires Fix completed in 21.0s (768x768 → 1536x1536)
🔧 Applying CodeFormer face restoration (weight=0.6)...
   Detected 1 face(s)
✅ Face restoration completed (1 face(s) restored)
🎉 Generation completed successfully!
   Total time: 25.4s
   Image size: 892KB
   Resolution: 1536x1536
```

## ✅ Success Indicators

You'll know everything is working when:
1. ✅ Health endpoint returns `"status": "healthy"`
2. ✅ `model_loaded: true` in health response
3. ✅ `codeformer_available: true` in health response
4. ✅ `realesrgan_available: true` in health response
5. ✅ Image generation completes in 15-30 seconds
6. ✅ Generated faces are **crisp and photorealistic**

## 🎉 What to Expect

### Before (SD v1.5):
- Soft, blurry faces
- 512x512 resolution
- "AI-generated" look
- Plastic-like skin texture

### After (SDXL + Upgrades):
- **Sharp, detailed faces**
- **1536x1536 resolution** (with hires fix)
- **Photorealistic quality**
- **Natural skin texture with pores**
- **Clear, focused eyes**
- Professional photography quality

## 🚀 Next Steps After Testing

Once confirmed working:
1. Update the frontend to use the new API parameters
2. Enable hires fix by default for face-focused images
3. Consider caching generated images in Firebase Storage
4. Monitor generation times and optimize settings
5. Celebrate the massive quality improvement! 🎉

---

**Status**: Ready to start! Just run the API and test. 90% complete! 🚀

