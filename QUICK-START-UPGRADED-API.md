# 🚀 Quick Start: Upgraded SDXL API

**Goal**: Start the upgraded SDXL API and see crisp, photorealistic faces

**Time**: 5 minutes setup + 30 minutes model download (first time only)

---

## 📋 Prerequisites (Already Done ✅)

- [x] Vast.ai instance running (RTX 3090 Ti / 4090)
- [x] All dependencies installed
- [x] CodeFormer weights downloaded
- [x] RealESRGAN weights downloaded
- [x] `upgraded-sdxl-api.py` uploaded to `/root/`
- [x] SSH tunnel script ready (`start-vast-tunnel.ps1`)

---

## 🎯 Three Simple Steps

### Step 1: Start the API on Vast.ai (2 minutes)

**Open PowerShell/Terminal and run:**

```bash
ssh -p 45583 root@171.247.185.4
```

**Then on Vast.ai server:**

```bash
cd /root
python3 upgraded-sdxl-api.py
```

**You'll see:**
```
🚀 Starting SDXL + CodeFormer + RealESRGAN API...
🚀 Loading VAE model (stabilityai/sdxl-vae)...
   This may take a few minutes on first run (downloading ~350MB)
✅ VAE loaded
🚀 Loading SDXL Base model...
   This may take 15-20 minutes on first run (downloading ~7GB)
   ☕ Grab a coffee... Models will be cached for future use.
```

**✅ Keep this terminal open - the API is now downloading models!**

---

### Step 2: Start the SSH Tunnel (1 minute)

**While models download, open a NEW PowerShell window on your local machine:**

```powershell
cd C:\Users\danie\CascadeProjects\windsurf-project
.\start-vast-tunnel.ps1
```

**Expected output:**
```
🚀 Starting SSH tunnel to Vast.ai SDXL API...
🔗 Creating SSH tunnel: localhost:7860 → vast.ai:7860
```

**✅ Leave this running in the background**

---

### Step 3: Wait for Models (30-40 minutes, first time only)

**What's downloading:**
- SDXL Base: ~7GB (15-20 mins)
- SDXL Refiner: ~7GB (15-20 mins)
- VAE: ~350MB (2-3 mins)

**Progress indicators:**
```
🚀 Loading SDXL Base model (stabilityai/stable-diffusion-xl-base-1.0)...
   Downloading: 50% |████████████          | 3.5GB/7GB
```

**When complete, you'll see:**
```
✅ SDXL Base model loaded successfully
   VRAM after base: 8.2GB / 24.0GB
🚀 Loading SDXL Refiner model...
   ...
✅ SDXL Refiner model loaded successfully
✅ CodeFormer loaded successfully
✅ RealESRGAN loaded successfully
🎉 All models loaded successfully! Ready to generate images.
INFO:     Uvicorn running on http://0.0.0.0:7860
```

**✅ When you see this, you're ready to test!**

---

## 🧪 Quick Test (2 minutes)

### Test 1: Health Check

**PowerShell (new window):**
```powershell
Invoke-RestMethod http://localhost:7860/health
```

**Expected:**
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

**✅ All `true`? Perfect! Continue...**

---

### Test 2: Generate Test Image from Frontend

**PowerShell:**
```powershell
cd carrot
npm run dev
```

**Browser:**
```
http://localhost:3005/test-deepseek-images
```

**Click "Generate Image"**

**You should see:**
- Loading indicator
- Progress in API terminal
- **Beautiful, crisp 1024x1024 image generated!**

---

## 🎨 What Changed?

| Feature | Before (SD v1.5) | After (SDXL + Upgrades) |
|---------|------------------|-------------------------|
| Face Quality | Soft, blurry | **Sharp, detailed** |
| Resolution | 512x512 | **1536x1536** (with hires) |
| Skin Texture | Smooth/plastic | **Natural pores** |
| Eyes | Unfocused | **Clear, crisp** |
| Overall | "AI look" | **Photorealistic** |

---

## 🚨 Troubleshooting

### API not responding after 40 minutes?

**Check logs:**
```bash
# In the Vast.ai SSH terminal, press Ctrl+C to see any errors
# Then restart:
python3 /root/upgraded-sdxl-api.py
```

### SSH tunnel fails?

**Kill and restart:**
```powershell
Get-Process | Where-Object {$_.ProcessName -eq "ssh"} | Stop-Process -Force
.\start-vast-tunnel.ps1
```

### Out of disk space?

**Check space:**
```bash
df -h
```

**Need at least 20GB free for models**

---

## ✅ You're Done When...

1. ✅ API shows: `"status": "healthy"`
2. ✅ `model_loaded: true`
3. ✅ `codeformer_available: true`
4. ✅ `realesrgan_available: true`
5. ✅ Frontend generates images successfully
6. ✅ Faces look **crisp and photorealistic**

---

## 🎉 Success! What's Next?

1. **Compare Images**: Generate the same prompt with and without face restoration
2. **Test Hires Fix**: Try `hires_fix: true` for 1536x1536 resolution
3. **Optimize Settings**: Experiment with different parameters
4. **Integrate**: Update your main image generation flow
5. **Deploy**: Consider making this the default for all face images

---

## 📚 More Info

- Full Testing Guide: `TEST-UPGRADED-API.md`
- Hires Fix Guide: `docs/sdxl/HIRES-FIX-GUIDE.md`
- CodeFormer Guide: `docs/sdxl/CODEFORMER-FACE-RESTORATION.md`
- RealESRGAN Guide: `docs/sdxl/REALESRGAN-NEURAL-UPSCALING.md`

---

**Ready?** Start with Step 1 above! 🚀

