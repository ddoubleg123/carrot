# SDXL Quick Reference Card

## 🚀 Quick Deploy (Copy-Paste)

```powershell
# Windows PowerShell - From project root

# 1. Upload files
.\upload-sdxl-files.ps1

# 2. SSH to Vast.ai
ssh -p 45583 root@171.247.185.4

# 3. Deploy (on Vast.ai)
chmod +x /root/*.sh && ./deploy-sdxl.sh

# 4. Wait 20-30 min for models to download ☕

# 5. Verify
./verify-sdxl.sh
```

---

## 📊 Key Information

### Models Being Installed
- `stabilityai/stable-diffusion-xl-base-1.0` (~7GB)
- `stabilityai/stable-diffusion-xl-refiner-1.0` (~7GB)
- `stabilityai/sdxl-vae` (~350MB)
- **Total:** ~15GB

### System Requirements
- **GPU:** RTX 3090/4090 (24GB VRAM)
- **Disk:** 20GB+ free space
- **Time:** 40-55 minutes (first run)
- **Network:** Fast connection for downloads

### Performance
- **Resolution:** 1024x1024 (vs 512x512)
- **Generation Time:** 10-20s (vs 5-10s)
- **Quality:** 3-4x better
- **VRAM Usage:** ~16GB (vs ~6GB)

---

## 🔧 Essential Commands

### On Vast.ai Instance

```bash
# Check service status
ps aux | grep upgraded-sdxl-api.py

# View logs
tail -f /tmp/sdxl-api.log

# Check GPU
nvidia-smi

# Health check
curl http://localhost:7860/health

# Test generation
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"red apple","num_inference_steps":15,"width":512,"height":512}'

# Restart service
pkill -f upgraded-sdxl-api.py
nohup python3 /root/upgraded-sdxl-api.py > /tmp/sdxl-api.log 2>&1 &

# Rollback to SD v1.5
./rollback-sdxl.sh
```

### On Local Machine (Windows)

```powershell
# SSH tunnel (keep running)
ssh -o StrictHostKeyChecking=no -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4

# Test health
Invoke-WebRequest -Uri http://localhost:7860/health

# Test generation
$body = @{prompt="basketball player";num_inference_steps=15;width=768;height=768} | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:7860/generate -Method POST -Body $body -ContentType "application/json"

# Start dev server
cd carrot
npm run dev
```

---

## ⚙️ Optimal Settings

### Fast Generation (8-12s)
```json
{
  "prompt": "your prompt",
  "num_inference_steps": 15,
  "width": 768,
  "height": 768,
  "use_refiner": false,
  "guidance_scale": 7.5
}
```

### Balanced (10-15s)
```json
{
  "prompt": "your prompt",
  "num_inference_steps": 20,
  "width": 1024,
  "height": 1024,
  "use_refiner": false,
  "guidance_scale": 7.5
}
```

### Best Quality (15-25s)
```json
{
  "prompt": "your prompt",
  "num_inference_steps": 30,
  "width": 1024,
  "height": 1024,
  "use_refiner": true,
  "guidance_scale": 8.0
}
```

---

## 🔥 Common Issues

### Models Still Downloading
**Symptom:** `model_loaded: false`  
**Fix:** Wait 20-30 min on first run

### Out of Memory
**Symptom:** `CUDA out of memory`  
**Fix:** Use 768x768, disable refiner

### SSH Tunnel Lost
**Symptom:** Connection timeout locally  
**Fix:** Restart tunnel (see commands above)

### Service Crashed
**Symptom:** Process not found  
**Fix:** Check `/tmp/sdxl-api.log`, restart service

### Slow Generation
**Symptom:** > 30 seconds  
**Fix:** Reduce steps to 15, use 768x768

---

## 📁 Important Files

### On Vast.ai
- `/root/upgraded-sdxl-api.py` - SDXL service
- `/root/deploy-sdxl.sh` - Deployment script
- `/root/verify-sdxl.sh` - Verification script
- `/root/rollback-sdxl.sh` - Rollback script
- `/tmp/sdxl-api.log` - Service logs
- `/root/backups/sd-v15-*/` - SD v1.5 backups

### Local
- `SDXL-DEPLOYMENT-PLAN.md` - Full deployment plan
- `SDXL-MIGRATION-GUIDE.md` - Step-by-step guide
- `upload-sdxl-files.ps1` - Upload helper

---

## 🎯 Success Criteria

- [ ] Health endpoint returns `model_loaded: true`
- [ ] Can generate 1024x1024 image in < 30s
- [ ] No CUDA errors in logs
- [ ] VRAM usage < 20GB
- [ ] Application generates SDXL images
- [ ] Quality visibly better than SD v1.5

---

## 💡 Pro Tips

1. **First run takes 30+ min** - Models downloading, be patient
2. **Keep SSH tunnel running** - Required for local development
3. **Monitor VRAM** - Should be 15-18GB loaded, < 20GB generating
4. **Adjust steps for speed** - 15 steps = fast, 30 steps = quality
5. **Use refiner selectively** - Adds 5-10s but improves quality
6. **Cache is your friend** - Second run is instant (models cached)
7. **Rollback is safe** - Can revert to SD v1.5 in < 1 minute

---

## 📞 Need Help?

1. Check logs: `tail -f /tmp/sdxl-api.log`
2. Verify health: `curl http://localhost:7860/health`
3. Check GPU: `nvidia-smi`
4. Review full guide: `SDXL-MIGRATION-GUIDE.md`
5. Rollback if needed: `./rollback-sdxl.sh`

---

## 🎉 You're Ready!

Follow the Quick Deploy section at the top and you'll have SDXL running in ~45 minutes.

**Total effort:** 5 minutes active work, 40 minutes waiting for downloads.

Good luck! 🚀

