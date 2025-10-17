# ✅ Launch Checklist: Upgraded SDXL API

**Quick Reference**: Use this checklist to launch and test the upgraded SDXL API

---

## 📋 Pre-Launch Verification (Already Complete ✅)

- [x] Code complete (`upgraded-sdxl-api.py`)
- [x] Dependencies installed on Vast.ai
- [x] CodeFormer weights downloaded
- [x] RealESRGAN weights downloaded
- [x] Frontend integration updated
- [x] Documentation created
- [x] Test scripts ready

**Status**: Everything is ready! Proceed to launch.

---

## 🚀 Launch Steps

### [ ] 1. Start API on Vast.ai (2 minutes)

**Terminal 1 - SSH into Vast.ai:**
```bash
ssh -p 45583 root@171.247.185.4
```

**On the server:**
```bash
cd /root
python3 upgraded-sdxl-api.py
```

**What to expect:**
```
🚀 Starting SDXL + CodeFormer + RealESRGAN API...
🚀 Loading VAE model...
🚀 Loading SDXL Base model...
   ☕ Grab a coffee... (15-20 mins first time)
```

**❗ Keep this terminal open!**

---

### [ ] 2. Start SSH Tunnel (1 minute)

**Terminal 2 - Local PowerShell:**
```powershell
cd C:\Users\danie\CascadeProjects\windsurf-project
.\start-vast-tunnel.ps1
```

**What to expect:**
```
🚀 Starting SSH tunnel to Vast.ai SDXL API...
🔗 Creating SSH tunnel: localhost:7860 → vast.ai:7860
✅ SSH tunnel is working!
```

**❗ Keep this running!**

---

### [ ] 3. Wait for Models to Download (30-40 minutes, first time only)

**What's downloading:**
- [ ] SDXL Base (~7GB, 15-20 mins)
- [ ] SDXL Refiner (~7GB, 15-20 mins)
- [ ] VAE (~350MB, 2-3 mins)

**Watch Terminal 1 for progress:**
```
✅ VAE loaded
✅ SDXL Base model loaded successfully
✅ SDXL Refiner model loaded successfully
✅ CodeFormer loaded successfully
✅ RealESRGAN loaded successfully
🎉 All models loaded successfully! Ready to generate images.
```

**✅ When you see this, proceed to testing!**

---

## 🧪 Testing Steps

### [ ] 4. Run Automated Test Script (2 minutes)

**Terminal 3 - New PowerShell:**
```powershell
cd C:\Users\danie\CascadeProjects\windsurf-project
.\test-upgraded-api.ps1
```

**What it does:**
1. Checks SSH tunnel
2. Verifies API health
3. Generates test image
4. Saves locally as `test-output-upgraded-sdxl.png`
5. Opens it automatically

**Expected results:**
```
✅ SSH tunnel is active
✅ API is responding
   Status: healthy
   Models Loaded: True
   CodeFormer Available: True
   RealESRGAN Available: True
✅ Image generated successfully!
   Generation Time: 20-30s
   Resolution: 1024x1024
💾 Image saved to: test-output-upgraded-sdxl.png
```

**✅ Check the image - faces should be crisp and detailed!**

---

### [ ] 5. Test from Frontend (5 minutes)

**Terminal 4 - New PowerShell:**
```powershell
cd carrot
npm run dev
```

**Browser:**
1. Navigate to: http://localhost:3005/test-deepseek-images
2. Click "Generate Image"
3. Wait 20-30 seconds
4. Image appears!

**What to check:**
- [ ] Image generates successfully
- [ ] Face is sharp and detailed (not blurry)
- [ ] Skin texture looks natural
- [ ] Eyes are clear and focused
- [ ] Overall photorealistic quality

**✅ Compare with old SD v1.5 images - difference should be dramatic!**

---

## 📊 Quality Verification Checklist

Compare the generated images with your previous SD v1.5 images:

### Visual Quality:
- [ ] **Faces**: Sharper and more detailed
- [ ] **Eyes**: Clear and focused (not blurry)
- [ ] **Skin**: Natural texture (not plastic-looking)
- [ ] **Details**: Fine details visible (pores, hair, etc.)
- [ ] **Overall**: Photorealistic (not "AI-generated" look)

### Technical Quality:
- [ ] **Resolution**: 1024x1024 (vs 512x512)
- [ ] **File size**: ~800KB-1MB (higher quality)
- [ ] **No artifacts**: Clean, no weird distortions
- [ ] **Color**: Natural, not oversaturated

### Performance:
- [ ] **Generation time**: 20-30s (acceptable for quality)
- [ ] **Success rate**: 100% generation success
- [ ] **Error rate**: No errors or crashes

**✅ If all checks pass, you're good to go!**

---

## 🎯 Success Criteria

Mark when complete:

- [ ] **API running**: Terminal 1 shows "Ready to generate images"
- [ ] **Tunnel active**: Terminal 2 shows "SSH tunnel is working"
- [ ] **Test passed**: Script generated image successfully
- [ ] **Frontend works**: Test page generates images
- [ ] **Quality excellent**: Images are crisp and photorealistic
- [ ] **No errors**: All tests completed without errors

**✅ All checked? Congratulations - you're done!** 🎉

---

## 🔧 Troubleshooting Checklist

### Issue: "API not responding"
- [ ] Wait 30-40 mins for models to download (first time)
- [ ] Check Terminal 1 for error messages
- [ ] Try restarting API: `pkill python3 && python3 /root/upgraded-sdxl-api.py`

### Issue: "SSH tunnel failed"
- [ ] Kill existing tunnels: `Get-Process | Where-Object {$_.ProcessName -eq "ssh"} | Stop-Process -Force`
- [ ] Restart tunnel: `.\start-vast-tunnel.ps1`
- [ ] Check if port 7860 is free: `Get-NetTCPConnection -LocalPort 7860`

### Issue: "Models not downloading"
- [ ] Check disk space: `df -h` (need 20GB+)
- [ ] Check internet: `ping huggingface.co`
- [ ] Check HuggingFace status: https://status.huggingface.co

### Issue: "Out of memory"
- [ ] Restart API to clear VRAM
- [ ] Check VRAM usage in logs
- [ ] Vast.ai has 24GB - should be enough

### Issue: "Generation too slow"
- [ ] First generation is always slower (loading)
- [ ] SDXL takes 20-30s (vs 8s for SD v1.5)
- [ ] This is normal for the quality improvement

**Still stuck?** Check `TEST-UPGRADED-API.md` for detailed troubleshooting.

---

## 📝 Post-Launch Tasks

After successful testing:

### Immediate:
- [ ] Save example images for before/after comparison
- [ ] Document quality improvements
- [ ] Share results with team (if applicable)

### Short Term:
- [ ] Test with different prompts (sports, tech, politics)
- [ ] Experiment with hires_fix for 1536x1536 images
- [ ] Fine-tune face detection keywords if needed
- [ ] Monitor generation times and success rates

### Long Term:
- [ ] Consider enabling by default for all face images
- [ ] Implement image caching to avoid regeneration
- [ ] Explore custom fine-tuning for your style
- [ ] Track cost vs quality improvements

---

## 📚 Quick Reference Links

- **Start Here**: `START-HERE.md` (simple 2-command guide)
- **Detailed Guide**: `QUICK-START-UPGRADED-API.md`
- **Testing Guide**: `TEST-UPGRADED-API.md`
- **Current Status**: `CURRENT-STATUS.md`
- **Session Summary**: `SESSION-SUMMARY.md`

**Vast.ai Connection:**
- SSH: `ssh -p 45583 root@171.247.185.4`
- Local API: http://localhost:7860
- Test Page: http://localhost:3005/test-deepseek-images

---

## 🎉 Final Checklist

Before you're done, verify:

- [ ] **API is running** and responsive
- [ ] **Models are loaded** (all 4 features available)
- [ ] **Test image generated** successfully
- [ ] **Quality is excellent** (crisp, photorealistic faces)
- [ ] **Frontend works** without errors
- [ ] **Documentation reviewed** and understood

**✅ All done? Congratulations!** 🎊

You now have a production-ready SDXL image generation system with:
- ✨ Crisp, photorealistic faces
- ✨ CodeFormer face restoration
- ✨ RealESRGAN neural upscaling
- ✨ SDXL quality (state-of-the-art)
- ✨ Automatic feature detection
- ✨ Comprehensive error handling

**Enjoy your upgraded image generation!** 🚀

---

**Time to Complete**: 35-45 minutes (mostly waiting for downloads)  
**Result**: Dramatically improved image quality! 🎨

