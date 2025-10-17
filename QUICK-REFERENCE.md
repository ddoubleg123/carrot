# 🚀 Quick Reference Card - Upgraded SDXL API

**Print this or keep it handy during launch!**

---

## 🎯 Two Commands to Launch

### 1️⃣ Start API on Vast.ai:
```bash
ssh -p 45583 root@171.247.185.4
cd /root && python3 upgraded-sdxl-api.py
```
**Keep terminal open!**

### 2️⃣ Start SSH Tunnel (new terminal):
```powershell
.\start-vast-tunnel.ps1
```
**Keep running!**

---

## ⏳ Wait Times

| Task | Time | Notes |
|------|------|-------|
| API startup | 2 mins | If models cached |
| Model download | 30-40 mins | **First time only!** |
| Image generation | 20-30s | Worth it for quality |

---

## 🧪 Test Commands

### Quick test:
```powershell
.\test-upgraded-api.ps1
```

### Health check:
```powershell
Invoke-RestMethod http://localhost:7860/health
```

### Frontend test:
```
http://localhost:3005/test-deepseek-images
```

---

## ✅ Success Indicators

```json
{
  "status": "healthy",
  "model_loaded": true,
  "codeformer_available": true,
  "realesrgan_available": true,
  "vram_available": "12.5GB / 24.0GB"
}
```

**All `true`?** ✅ You're good!

---

## 📊 Quality Comparison

| Feature | Before | After |
|---------|--------|-------|
| Faces | Blurry | **Sharp** ✨ |
| Resolution | 512px | **1024px** ✨ |
| Texture | Plastic | **Natural** ✨ |
| Eyes | Unfocused | **Clear** ✨ |

---

## 🐛 Quick Fixes

### API not responding?
```bash
# Restart API
pkill python3
python3 /root/upgraded-sdxl-api.py
```

### Tunnel not working?
```powershell
# Restart tunnel
Get-Process -Name ssh | Stop-Process -Force
.\start-vast-tunnel.ps1
```

---

## 📝 Important Files

- `START-HERE.md` - Read this first
- `LAUNCH-CHECKLIST.md` - Step-by-step
- `TEST-UPGRADED-API.md` - Troubleshooting
- `test-upgraded-api.ps1` - Test script

---

## 🎨 What's New?

**Automatically enabled:**
- ✅ SDXL Base + Refiner
- ✅ CodeFormer (for faces)
- ✅ RealESRGAN upscaling
- ✅ Enhanced prompts

**No config needed - just works!**

---

## 📞 Connection Info

- **SSH**: `ssh -p 45583 root@171.247.185.4`
- **Local API**: http://localhost:7860
- **Test Page**: http://localhost:3005/test-deepseek-images

---

## ⚡ Quick Status Check

```powershell
# Is tunnel running?
Get-NetTCPConnection -LocalPort 7860

# Is API healthy?
Invoke-RestMethod http://localhost:7860/health

# Generate test image
.\test-upgraded-api.ps1
```

---

## 🎯 Today's Goal

**Generate crisp, photorealistic faces!**

From: 😕 Blurry AI faces  
To: 🎉 Sharp photorealistic portraits

---

**Total Time**: 35-45 mins (mostly waiting)  
**Status**: 95% complete - just need to start!

**Ready?** Run command 1️⃣ above! 🚀

