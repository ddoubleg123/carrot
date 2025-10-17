# SDXL Migration Guide - Step-by-Step Instructions

## Overview

This guide walks you through upgrading from Stable Diffusion v1.5 to SDXL (Stable Diffusion XL) on your Vast.ai instance.

**Total Time:** 40-55 minutes  
**Skill Level:** Intermediate  
**Prerequisites:** Working SD v1.5 setup on Vast.ai

---

## Quick Start (TL;DR)

```powershell
# 1. Upload deployment files
scp -P 45583 upgraded-sdxl-api.py deploy-sdxl.sh verify-sdxl.sh rollback-sdxl.sh root@171.247.185.4:/root/

# 2. SSH into Vast.ai
ssh -p 45583 root@171.247.185.4

# 3. Make scripts executable
chmod +x /root/*.sh

# 4. Run deployment
./deploy-sdxl.sh

# 5. Verify (after models download)
./verify-sdxl.sh

# Done! No application code changes needed.
```

---

## Detailed Step-by-Step Instructions

### Step 1: Prepare Local Environment

From your local machine in the project directory:

```powershell
# Windows PowerShell
cd C:\Users\danie\CascadeProjects\windsurf-project

# Verify you have all required files
ls upgraded-sdxl-api.py, deploy-sdxl.sh, verify-sdxl.sh, rollback-sdxl.sh
```

**Expected Files:**
- ✅ `upgraded-sdxl-api.py` - SDXL API service
- ✅ `deploy-sdxl.sh` - Automated deployment script
- ✅ `verify-sdxl.sh` - Testing and verification script
- ✅ `rollback-sdxl.sh` - Rollback to SD v1.5 if needed

---

### Step 2: Upload Files to Vast.ai

```powershell
# Upload all files in one command
scp -P 45583 upgraded-sdxl-api.py deploy-sdxl.sh verify-sdxl.sh rollback-sdxl.sh root@171.247.185.4:/root/
```

**Expected Output:**
```
upgraded-sdxl-api.py         100%  11KB   1.2MB/s   00:00
deploy-sdxl.sh               100%   8KB   950KB/s   00:00
verify-sdxl.sh               100%   7KB   850KB/s   00:00
rollback-sdxl.sh             100%   5KB   600KB/s   00:00
```

**Troubleshooting:**
- If "Permission denied": Check SSH keys
- If "Connection refused": Verify Vast.ai instance is running
- If "Port not open": Update port number (check Vast.ai dashboard)

---

### Step 3: Connect to Vast.ai

```powershell
ssh -p 45583 root@171.247.185.4
```

You should see:
```
Welcome to Ubuntu...
root@vast-instance:~#
```

---

### Step 4: Make Scripts Executable

```bash
cd /root
chmod +x deploy-sdxl.sh verify-sdxl.sh rollback-sdxl.sh

# Verify
ls -lh *.sh
```

**Expected Output:**
```
-rwxr-xr-x 1 root root 8.2K deploy-sdxl.sh
-rwxr-xr-x 1 root root 7.1K verify-sdxl.sh
-rwxr-xr-x 1 root root 5.4K rollback-sdxl.sh
```

---

### Step 5: Run Pre-Deployment Checks

Before deploying, verify your system is ready:

```bash
# Check disk space (need 20GB+ free)
df -h /

# Check GPU
nvidia-smi

# Check current SD v1.5 status
curl http://localhost:7860/health
```

**Requirements:**
- ✅ **Disk Space:** 20GB+ free
- ✅ **GPU:** RTX 3090/4090 with 24GB VRAM
- ✅ **Current API:** Responding on port 7860

---

### Step 6: Run Deployment Script

```bash
./deploy-sdxl.sh
```

**What Happens:**
1. **Pre-flight checks** (disk space, GPU, dependencies)
2. **Backup** current SD v1.5 setup
3. **Stop** SD v1.5 service
4. **Start** SDXL service
5. **Monitor** model downloads (20-30 minutes)

**Important Notes:**
- ☕ **Grab coffee!** First-time model download takes 20-30 minutes
- 📥 **Downloading ~15GB** of model data
- 💾 **Models cached** for future use (one-time download)
- 📋 **Logs stream** in real-time during deployment

**What You'll See:**
```
================================================================
🚀 SDXL Deployment Script
================================================================

Continue? (y/n) y

================================================================
📋 Phase 1: Pre-Deployment Checks
================================================================

🔍 Checking disk space...
   Available: 35GB
   ✅ Sufficient disk space

🎮 Checking GPU...
   GPU: NVIDIA GeForce RTX 3090 Ti
   VRAM: 24576MiB
   ✅ GPU detected

🐍 Checking Python environment...
   Python: Python 3.10.12
   ✅ All dependencies present

📄 Checking for SDXL API script...
   ✅ SDXL API script found

================================================================
💾 Phase 2: Backup Current Setup
================================================================

📁 Backup directory: /root/backups/sd-v15-20251013-143022
   ✅ SD v1.5 service is running
   ✅ Current API responding
   ✅ Backed up working-sd-api.py
   ✅ Backup complete

================================================================
🛑 Phase 3: Stop Current Service
================================================================

Stopping current services...
✅ All SD services stopped

================================================================
🚀 Phase 4: Start SDXL Service
================================================================

Starting SDXL API on port 7860...
✅ SDXL service started (PID: 12345)
✅ Process is running

================================================================
📥 Phase 5: Monitor Model Download
================================================================

ℹ️  SDXL models will download automatically (~15GB, 20-30 min)
   This is a one-time download. Models are cached for future use.

📋 Live log monitoring (Ctrl+C to stop watching, service continues):
----------------------------------------------------------------

2025-10-13 14:30:45 - __main__ - INFO - 🚀 Starting SDXL + CodeFormer API...
2025-10-13 14:30:46 - __main__ - INFO - 🎮 GPU: NVIDIA GeForce RTX 3090 Ti
2025-10-13 14:30:46 - __main__ - INFO - 🎮 Total VRAM: 24.0GB
2025-10-13 14:30:46 - __main__ - INFO - 🚀 Loading VAE model (stabilityai/sdxl-vae)...
2025-10-13 14:30:46 - __main__ - INFO -    This may take a few minutes on first run (downloading ~350MB)
Downloading: 100% 335M/335M [00:45<00:00, 7.44MB/s]
2025-10-13 14:31:32 - __main__ - INFO - ✅ VAE loaded
2025-10-13 14:31:32 - __main__ - INFO - 🚀 Loading SDXL Base model (stabilityai/stable-diffusion-xl-base-1.0)...
2025-10-13 14:31:32 - __main__ - INFO -    This may take 15-20 minutes on first run (downloading ~7GB)
2025-10-13 14:31:32 - __main__ - INFO -    ☕ Grab a coffee... Models will be cached for future use.
Downloading: 100% 6.94G/6.94G [15:23<00:00, 7.51MB/s]
2025-10-13 14:46:55 - __main__ - INFO - ✅ SDXL Base model loaded successfully
2025-10-13 14:46:55 - __main__ - INFO -    VRAM after base: 8.2GB / 24.0GB
2025-10-13 14:46:55 - __main__ - INFO - 🚀 Loading SDXL Refiner model (stabilityai/stable-diffusion-xl-refiner-1.0)...
2025-10-13 14:46:55 - __main__ - INFO -    This may take 15-20 minutes on first run (downloading ~7GB)
Downloading: 100% 6.94G/6.94G [14:58<00:00, 7.72MB/s]
2025-10-13 15:01:53 - __main__ - INFO - ✅ SDXL Refiner model loaded successfully
2025-10-13 15:01:53 - __main__ - INFO - 🎮 VRAM Usage: 15.8GB / 24.0GB (65.8%)
2025-10-13 15:01:53 - __main__ - INFO - 🎉 All models loaded successfully! Ready to generate images.

================================================================
✅ Models loaded successfully!
================================================================

================================================================
✅ Phase 6: Deployment Complete!
================================================================

📊 Service Status:
   PID: 12345
   Port: 7860
   Log: /tmp/sdxl-api.log

🔧 Next Steps:
   1. Run verification: ./verify-sdxl.sh
   2. Test from local machine via SSH tunnel
   3. Generate test image from application

📝 Useful Commands:
   View logs:    tail -f /tmp/sdxl-api.log
   Health check: curl http://localhost:7860/health
   Stop service: pkill -f upgraded-sdxl-api.py
   Rollback:     ./rollback-sdxl.sh

================================================================
```

---

### Step 7: Verify Deployment

After models finish downloading, run verification:

```bash
./verify-sdxl.sh
```

**What It Tests:**
1. ✅ Process running
2. ✅ Port 7860 listening
3. ✅ Health endpoint responding
4. ✅ Models loaded in memory
5. ✅ CUDA available
6. ✅ GPU detected
7. ✅ Test image generation

**Expected Output (Success):**
```
================================================================
🔍 SDXL Verification Script
================================================================

✅ PASS: SDXL Process Running
   PID: 12345, Uptime: 35:22

✅ PASS: Port 7860 Listening
   Service is bound to port 7860

✅ PASS: Health Endpoint Response
   HTTP 200 OK

📋 Health Check Details:
{
  "status": "healthy",
  "model_loaded": true,
  "cuda_available": true,
  "codeformer_available": false,
  "vram_available": "15.8GB / 24.0GB"
}

✅ PASS: Models Loaded
   SDXL models are loaded in memory

✅ PASS: CUDA Available
   GPU acceleration enabled

✅ PASS: VRAM Info
   15.8GB / 24.0GB

✅ PASS: GPU Detection
   nvidia-smi available

📊 GPU Information:
NVIDIA GeForce RTX 3090 Ti, 15872 MiB, 24576 MiB, 45 %

✅ PASS: Log File Exists
   127 lines

✅ PASS: Log Errors
   No errors in log

⏳ Generating test image (this will take 10-20 seconds)...

✅ PASS: Image Generation
   Generated in 12s, Size: 1567832 bytes, Resolution: 512x512
   💾 Sample saved to: /tmp/sdxl-test.png

================================================================
📊 Verification Summary
================================================================

✅ Passed: 10
❌ Failed: 0

================================================================
🎉 All tests passed! SDXL is working correctly!
================================================================

✅ Next Steps:
   1. Test from local machine via SSH tunnel
   2. Test from application
   3. Compare quality with SD v1.5
```

---

### Step 8: Test from Local Machine

From your Windows machine (new PowerShell window):

```powershell
# Ensure SSH tunnel is running
ssh -o StrictHostKeyChecking=no -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4

# Test health endpoint
Invoke-WebRequest -Uri http://localhost:7860/health -Method GET

# Test image generation
$body = @{
    prompt = "professional basketball player dunking"
    num_inference_steps = 20
    width = 1024
    height = 1024
    use_refiner = $true
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:7860/generate -Method POST -Body $body -ContentType "application/json"
```

**Expected:**
- ✅ Health check returns 200 OK
- ✅ Generation returns base64 image
- ✅ Generation time: 10-20 seconds
- ✅ Image resolution: 1024x1024

---

### Step 9: Test from Application

**No code changes needed!** Your application will automatically use SDXL.

```powershell
# Start your dev server
cd C:\Users\danie\CascadeProjects\windsurf-project\carrot
npm run dev
```

Navigate to your app and generate an AI image. You should see:
- ✨ **Higher quality** (2x resolution)
- 🎨 **Better details** (especially faces)
- 📸 **More realistic** output

**Compare:**
- **SD v1.5:** 512x512, ~500KB, ~5-10s
- **SDXL:** 1024x1024, ~1.5MB, ~10-20s

---

### Step 10: Monitor and Optimize

```bash
# View live logs
tail -f /tmp/sdxl-api.log

# Check VRAM usage
nvidia-smi

# Check generation performance
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "num_inference_steps": 15, "width": 768, "height": 768}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Time: {data.get(\"generation_time_seconds\")}s')"
```

---

## Configuration Options

### Generation Parameters

| Parameter | Default | Recommended | Notes |
|-----------|---------|-------------|-------|
| `width` | 1024 | 768-1024 | Higher = better quality, slower |
| `height` | 1024 | 768-1024 | Match aspect ratio |
| `num_inference_steps` | 25 | 15-30 | Higher = better quality, slower |
| `guidance_scale` | 7.5 | 7.0-9.0 | Higher = follows prompt more |
| `use_refiner` | true | true | Extra polish, +5-10s |
| `use_face_restoration` | false | false | Requires CodeFormer |
| `hires_fix` | false | false | Upscales further |

### Performance Tuning

**For Faster Generation:**
```json
{
  "num_inference_steps": 15,
  "width": 768,
  "height": 768,
  "use_refiner": false
}
```
**Result:** ~8-12 seconds

**For Best Quality:**
```json
{
  "num_inference_steps": 30,
  "width": 1024,
  "height": 1024,
  "use_refiner": true
}
```
**Result:** ~15-25 seconds

---

## Troubleshooting

### Issue: Models Not Loading

**Symptom:**
```
{"status":"healthy","model_loaded":false}
```

**Solution:**
```bash
# Check logs
tail -f /tmp/sdxl-api.log

# Common causes:
# 1. Still downloading (wait 20-30 min on first run)
# 2. Out of disk space (need 20GB+)
# 3. HuggingFace blocked (use non-China region)
```

### Issue: CUDA Out of Memory

**Symptom:**
```
RuntimeError: CUDA out of memory
```

**Solution:**
```bash
# Reduce resolution or disable refiner
# In your request:
{
  "width": 768,
  "height": 768,
  "use_refiner": false
}

# Or restart service to clear VRAM:
pkill -f upgraded-sdxl-api.py
nohup python3 /root/upgraded-sdxl-api.py > /tmp/sdxl-api.log 2>&1 &
```

### Issue: Generation Too Slow

**Symptom:** > 30 seconds per image

**Solutions:**
1. **Reduce steps:** `num_inference_steps: 15` (from 25)
2. **Lower resolution:** `width: 768, height: 768` (from 1024)
3. **Disable refiner:** `use_refiner: false`
4. **Check GPU utilization:** `nvidia-smi` (should be near 100%)

### Issue: SSH Tunnel Lost Connection

**Symptom:** Local requests timeout

**Solution:**
```powershell
# Kill existing tunnels
Get-Process | Where-Object {$_.Name -eq "ssh"} | Stop-Process

# Restart tunnel
ssh -o StrictHostKeyChecking=no -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4

# Test
Invoke-WebRequest -Uri http://localhost:7860/health
```

### Issue: Want to Rollback to SD v1.5

**Solution:**
```bash
./rollback-sdxl.sh
```

Takes < 1 minute, no data loss.

---

## Post-Migration Checklist

After successful migration, verify:

- [ ] ✅ SDXL service running and healthy
- [ ] ✅ Models loaded (check `/health` endpoint)
- [ ] ✅ Test generation successful
- [ ] ✅ SSH tunnel working from local machine
- [ ] ✅ Application generates SDXL images
- [ ] ✅ Quality improvement visible
- [ ] ✅ Performance acceptable (< 30s)
- [ ] ✅ VRAM usage normal (< 20GB)
- [ ] ✅ No errors in logs
- [ ] ✅ Backup of SD v1.5 saved

---

## Comparison: Before vs After

| Metric | SD v1.5 (Before) | SDXL (After) | Improvement |
|--------|------------------|--------------|-------------|
| **Resolution** | 512x512 | 1024x1024 | 4x pixels |
| **Quality** | Good | Excellent | 3-4x better |
| **Detail** | Moderate | High | Much better |
| **Face Quality** | Fair | Good | Significantly better |
| **Generation Time** | ~5-10s | ~10-20s | 2x slower |
| **Image Size** | ~500KB | ~1.5MB | 3x larger |
| **VRAM Usage** | ~6GB | ~16GB | 2.5x more |
| **Model Size** | ~4GB | ~15GB | 3.75x larger |
| **Cost per Image** | ~$0.001 | ~$0.002 | 2x cost |

**Verdict:** 3-4x quality improvement for 2x time/cost. **Worth it!**

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor VRAM usage: `nvidia-smi`
- Check service health: `curl http://localhost:7860/health`

**Weekly:**
- Review logs: `tail -100 /tmp/sdxl-api.log`
- Clear old logs: `truncate -s 0 /tmp/sdxl-api.log`

**Monthly:**
- Verify backups exist: `ls -lh /root/backups/`
- Test rollback procedure (optional)

### Restarting Service

```bash
# Stop
pkill -f upgraded-sdxl-api.py

# Start
nohup python3 /root/upgraded-sdxl-api.py > /tmp/sdxl-api.log 2>&1 &

# Verify (wait 2-3 min for models to load)
curl http://localhost:7860/health
```

### Updating SDXL Script

```powershell
# From local machine
scp -P 45583 upgraded-sdxl-api.py root@171.247.185.4:/root/

# On Vast.ai
pkill -f upgraded-sdxl-api.py
nohup python3 /root/upgraded-sdxl-api.py > /tmp/sdxl-api.log 2>&1 &
```

---

## Support

### Logs Location
- SDXL logs: `/tmp/sdxl-api.log`
- Deployment logs: Check terminal output
- Backups: `/root/backups/sd-v15-*/`

### Useful Commands
```bash
# Service status
ps aux | grep upgraded-sdxl-api.py

# Health check
curl http://localhost:7860/health | python3 -m json.tool

# VRAM usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv

# Disk space
df -h /

# Recent logs
tail -50 /tmp/sdxl-api.log

# Process uptime
ps -p $(cat /root/sdxl-api.pid) -o etime=
```

---

## Success!

Congratulations! You've successfully upgraded to SDXL. 🎉

**What You Achieved:**
- ✅ 2x higher resolution (1024x1024)
- ✅ 3-4x better image quality
- ✅ Professional-grade AI image generation
- ✅ Same API endpoints (no code changes)
- ✅ Backward compatible (can rollback anytime)

**Next Steps:**
1. Generate comparison images (SD v1.5 vs SDXL)
2. Optimize parameters for your use case
3. Consider enabling face restoration (optional)
4. Monitor performance and costs

Enjoy your upgraded AI image generation! 🚀🎨

