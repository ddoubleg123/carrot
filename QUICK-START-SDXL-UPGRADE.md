# Quick Start: SDXL Upgrade

## 🎯 Goal
Upgrade your Vast.ai Stable Diffusion API from SD 1.5 → SDXL for crisp, photorealistic face generation.

## ⚡ Fastest Path to Success

### Step 1: Upload Files (From Local Machine)

**Windows PowerShell:**
```powershell
.\start-vast-sdxl-upgrade.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy-sdxl-to-vast.sh
./deploy-sdxl-to-vast.sh
```

### Step 2: Execute on Vast.ai

SSH into Vast.ai:
```bash
ssh -p 14688 root@ssh4.vast.ai
```

Run the upgrade:
```bash
# 1. Cleanup (5 mins)
chmod +x vast-cleanup-sdxl-upgrade.sh
./vast-cleanup-sdxl-upgrade.sh

# 2. Check and free up space if needed
df -h /
# If less than 20GB free, remove SD 1.5:
rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5

# 3. Install packages (15 mins)
chmod +x install-sdxl-packages.sh
./install-sdxl-packages.sh

# 4. Start upgraded API (will download models on first run)
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &

# 5. Monitor progress
tail -f sdxl-api.log
# Wait for: "All models loaded successfully!"
```

### Step 3: Test (From Local Machine)

```bash
node test-upgraded-sdxl-api.js
```

## ✅ Success Indicators

- Health check returns `"models_loaded": true`
- Test images are saved to `test-results/` folder
- Faces are sharp and detailed (not blurry like SD 1.5)
- Generation takes 30-60 seconds

## 🔧 Quick Commands

```bash
# Check if running
ps aux | grep upgraded-sdxl-api

# Check health
curl http://localhost:7860/health

# View logs
tail -f /root/sdxl-api.log

# Restart API
pkill -f upgraded-sdxl-api.py
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &

# Check GPU
nvidia-smi

# Check disk
df -h /
```

## 🎨 Test from Your App

Navigate to: `http://localhost:3005/test-image-generation`

## ⏱️ Timeline

- **Upload files:** 2 minutes
- **Cleanup:** 5 minutes
- **Install packages:** 15 minutes
- **Download models (first run):** 15 minutes
- **Total:** ~40 minutes

## 📚 Detailed Guides

- **Full execution guide:** `SDXL-UPGRADE-EXECUTION.md`
- **Original plan:** `VAST-AI-SDXL-UPGRADE-PLAN.md`

## 🚨 Common Issues

### "Out of disk space"
```bash
rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5
rm -rf /root/.cache/huggingface/hub/models--*/.git
```

### "Models not loading"
Check logs and wait - first download takes 10-15 minutes

### "API not responding"
```bash
tail -100 /root/sdxl-api.log
```

## 🎉 You're Done!

Once you see "All models loaded successfully!" in the logs, your SDXL API is ready to generate high-quality images with detailed faces.

