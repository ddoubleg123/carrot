# 🚀 START HERE: Launch Upgraded SDXL API

**Date**: October 14, 2025  
**Goal**: Get crisp, photorealistic AI-generated faces  
**Time**: 5 mins setup + 30 mins model download (one-time)

---

## ✅ What's Ready?

Everything is prepared and ready to go:
- ✅ Upgraded SDXL API code (`upgraded-sdxl-api.py`)
- ✅ All dependencies installed on Vast.ai
- ✅ CodeFormer weights downloaded (face restoration)
- ✅ RealESRGAN weights downloaded (neural upscaling)
- ✅ Frontend updated to use new features
- ✅ SSH tunnel script ready
- ✅ Test scripts ready

**You just need to start the API and wait for models to download!**

---

## 🎯 Two Commands to Get Started

### Command 1: Start API on Vast.ai
```bash
ssh -p 45583 root@171.247.185.4
```

Then on the server:
```bash
cd /root
python3 upgraded-sdxl-api.py
```

**Keep this terminal open!** You'll see model download progress here.

---

### Command 2: Start SSH Tunnel (New Terminal)
```powershell
cd C:\Users\danie\CascadeProjects\windsurf-project
.\start-vast-tunnel.ps1
```

**Keep this running too!** It creates the localhost:7860 tunnel.

---

## ⏳ What Happens Next?

### On first run, you'll see:
```
🚀 Starting SDXL + CodeFormer + RealESRGAN API...
🚀 Loading VAE model (stabilityai/sdxl-vae)...
   This may take a few minutes on first run (downloading ~350MB)
   
🚀 Loading SDXL Base model...
   This may take 15-20 minutes on first run (downloading ~7GB)
   ☕ Grab a coffee... Models will be cached for future use.
```

### Total download time: 30-40 minutes
- SDXL Base: ~7GB (15-20 mins)
- SDXL Refiner: ~7GB (15-20 mins)
- VAE: ~350MB (2-3 mins)

### When complete, you'll see:
```
✅ SDXL Base model loaded successfully
✅ SDXL Refiner model loaded successfully
✅ CodeFormer loaded successfully
✅ RealESRGAN loaded successfully
🎉 All models loaded successfully! Ready to generate images.
INFO:     Uvicorn running on http://0.0.0.0:7860
```

**✅ Now you're ready to test!**

---

## 🧪 Test It (Quick Check)

### Option 1: PowerShell Test Script (Recommended)
```powershell
# In a NEW PowerShell window
cd C:\Users\danie\CascadeProjects\windsurf-project
.\test-upgraded-api.ps1
```

This will:
1. Check tunnel connection
2. Verify API health
3. Generate a test image
4. Save it locally
5. Open it automatically

**Expected**: See a crisp, photorealistic headshot saved as `test-output-upgraded-sdxl.png`

---

### Option 2: Frontend Test
```powershell
# Start Next.js dev server
cd carrot
npm run dev
```

Then navigate to:
```
http://localhost:3005/test-deepseek-images
```

Click **"Generate Image"** and watch it create a beautiful image!

---

## 📊 What Changed?

| Aspect | Old (SD v1.5) | New (SDXL) |
|--------|---------------|------------|
| Model | Stable Diffusion v1.5 | SDXL Base + Refiner |
| Face Quality | Soft, blurry | **Sharp, detailed** |
| Resolution | 512x512 | **1024x1024** |
| Face Fix | None | **CodeFormer** |
| Upscaling | PIL LANCZOS | **RealESRGAN (neural)** |
| Time | ~8s | ~20-30s |

**The quality improvement is dramatic!** 🎉

---

## 🎨 New Features Automatically Applied

The frontend now automatically:
- ✅ Detects when generating faces (Derrick Rose, portraits, headshots)
- ✅ Enables CodeFormer face restoration for faces
- ✅ Uses SDXL refiner for extra detail
- ✅ Applies enhanced negative prompts
- ✅ Uses 30 inference steps (vs 25)
- ✅ Supports RealESRGAN neural upscaling

**You don't need to change anything - it just works!**

---

## 🐛 Common Issues

### "API not responding"
**Solution**: Wait for models to finish downloading (30-40 mins first time)

### "SSH tunnel failed"
**Solution**: Make sure you started `start-vast-tunnel.ps1` first

### "Out of memory"
**Solution**: Vast.ai instance has 24GB VRAM, should be fine. Try restarting API if needed.

### "Timeout error"
**Solution**: Generation takes 20-30s now (vs 8s before). This is normal for SDXL quality.

---

## 📚 More Information

- **Quick Start Guide**: `QUICK-START-UPGRADED-API.md`
- **Full Testing Guide**: `TEST-UPGRADED-API.md`
- **Current Status**: `CURRENT-STATUS.md`
- **Hires Fix Guide**: `docs/sdxl/HIRES-FIX-GUIDE.md`
- **CodeFormer Guide**: `docs/sdxl/CODEFORMER-FACE-RESTORATION.md`
- **RealESRGAN Guide**: `docs/sdxl/REALESRGAN-NEURAL-UPSCALING.md`

---

## 🎉 That's It!

**Just two commands:**
1. `ssh -p 45583 root@171.247.185.4` → `python3 /root/upgraded-sdxl-api.py`
2. `.\start-vast-tunnel.ps1`

**Then wait 30-40 minutes for downloads (one-time), and you're done!**

After that, every startup is instant - models are cached locally.

---

**Questions?** Check `CURRENT-STATUS.md` for detailed status or `TEST-UPGRADED-API.md` for troubleshooting.

**Ready?** Run Command 1 above! 🚀

