# SDXL Upgrade Execution Guide

This guide walks you through executing the VAST-AI-SDXL-UPGRADE-PLAN.md step by step.

## 📋 Prerequisites

- Active Vast.ai instance with RTX 3090 Ti
- SSH access configured
- Local environment has Node.js installed
- SCP access to Vast.ai instance

## 🚀 Quick Start (Automated)

### Option 1: PowerShell Script (Recommended for Windows)

```powershell
.\start-vast-sdxl-upgrade.ps1
```

This will:
1. Upload all necessary files to Vast.ai
2. Display step-by-step instructions for manual execution

### Option 2: Bash Script (Linux/Mac)

```bash
chmod +x deploy-sdxl-to-vast.sh
./deploy-sdxl-to-vast.sh
```

## 📝 Manual Execution Steps

### Step 1: Upload Files to Vast.ai

```bash
# Upload cleanup script
scp -P 14688 vast-cleanup-sdxl-upgrade.sh root@ssh4.vast.ai:/root/

# Upload installation script
scp -P 14688 install-sdxl-packages.sh root@ssh4.vast.ai:/root/

# Upload upgraded API
scp -P 14688 upgraded-sdxl-api.py root@ssh4.vast.ai:/root/
```

### Step 2: SSH into Vast.ai

```bash
ssh -p 14688 root@ssh4.vast.ai
```

### Step 3: Run Cleanup Script

```bash
chmod +x vast-cleanup-sdxl-upgrade.sh
./vast-cleanup-sdxl-upgrade.sh
```

**IMPORTANT:** After cleanup, review the disk usage and manually remove SD 1.5 models if you need more space:

```bash
# Check what can be removed
du -h --max-depth=2 /root/.cache/huggingface | sort -rh | head -20

# Remove SD 1.5 models (if you don't need them)
rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5

# Remove Git history from models (saves significant space)
rm -rf /root/.cache/huggingface/hub/models--*/.git

# Verify you have at least 20GB free
df -h /
```

### Step 4: Install Packages

```bash
chmod +x install-sdxl-packages.sh
./install-sdxl-packages.sh
```

This will take 10-20 minutes. Wait for completion.

### Step 5: Start the Upgraded API

```bash
# Start in background with logging
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &

# Monitor logs
tail -f sdxl-api.log
```

**What to expect:**
- First run will download SDXL models (~14GB, takes 10-15 minutes)
- You'll see: "Loading SDXL models..."
- Wait for: "All models loaded successfully!"
- API will be available on port 7860

### Step 6: Test the API

From your **local machine**:

```bash
# Run test script
node test-upgraded-sdxl-api.js
```

This will:
- Test health endpoint
- Generate a test image with hires fix
- Generate a simple image
- Save results to `test-results/` folder

## 🔍 Verification

### Check if API is Running

On Vast.ai:
```bash
# Check process
ps aux | grep upgraded-sdxl-api

# Check health endpoint
curl http://localhost:7860/health

# Check GPU usage
nvidia-smi
```

Expected health response:
```json
{
  "status": "healthy",
  "models_loaded": true,
  "device": "cuda",
  "cuda_available": true,
  "gpu_info": {
    "gpu_name": "NVIDIA GeForce RTX 3090 Ti",
    "total_memory_gb": "23.70",
    "allocated_memory_gb": "14.23"
  }
}
```

## 🎨 Testing Image Generation

### From your local app:

Navigate to: `http://localhost:3005/test-image-generation`

### Using curl:

```bash
curl -X POST http://ssh4.vast.ai:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional headshot of a person, studio lighting, photorealistic, detailed face",
    "width": 1024,
    "height": 1024,
    "steps": 35,
    "cfg_scale": 7.0,
    "use_hires_fix": true
  }'
```

## 📊 Expected Results

- **Generation time:** 30-60 seconds per image
- **Image quality:** Sharp, detailed faces with natural lighting
- **Resolution:** 1024x1024 (or custom)
- **VRAM usage:** ~14GB (well within 23.7GB limit)

## 🐛 Troubleshooting

### API won't start

```bash
# Check logs
cat /root/sdxl-api.log

# Check Python
python3 --version
python3 -c "import torch; print(torch.cuda.is_available())"

# Restart API
pkill -f upgraded-sdxl-api.py
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &
```

### Out of disk space

```bash
# Check space
df -h /

# Clean more aggressively
rm -rf /root/.cache/huggingface/hub/models--*/.git
docker system prune -af --volumes

# Remove SD 1.5 if present
rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5
```

### Out of VRAM

```bash
# Check GPU memory
nvidia-smi

# Restart API to clear memory
pkill -f upgraded-sdxl-api.py
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &
```

### Models not loading

```bash
# Check HuggingFace cache
ls -la /root/.cache/huggingface/hub/

# Force re-download (remove corrupted models)
rm -rf /root/.cache/huggingface/hub/models--stabilityai--stable-diffusion-xl-base-1.0
rm -rf /root/.cache/huggingface/hub/models--stabilityai--stable-diffusion-xl-refiner-1.0

# Restart API (will re-download)
pkill -f upgraded-sdxl-api.py
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &
```

## 📈 Performance Optimization

### Enable xFormers (optional, for faster generation)

```bash
pip install xformers
```

Then modify `upgraded-sdxl-api.py` to add:
```python
base_pipe.enable_xformers_memory_efficient_attention()
refiner_pipe.enable_xformers_memory_efficient_attention()
```

### Adjust batch size for multiple generations

The API currently generates one image at a time. For batch processing, you can modify the pipeline to accept arrays.

## ✅ Success Criteria

- [ ] Disk space > 20GB free
- [ ] All packages installed
- [ ] SDXL models downloaded
- [ ] API responds to /health endpoint
- [ ] Test image generated successfully
- [ ] Faces are sharp and detailed (not blurry)
- [ ] Local app can connect to API

## 🎉 Next Steps

Once the upgrade is complete:

1. **Update your local app** to use the new SDXL endpoint
2. **Test face generation** with various prompts
3. **Adjust parameters** (steps, cfg_scale) for optimal results
4. **Consider adding CodeFormer** for face restoration (optional)
5. **Monitor VRAM usage** and adjust if needed

## 📞 Support

If you encounter issues:

1. Check logs: `tail -f /root/sdxl-api.log`
2. Check GPU: `nvidia-smi`
3. Check disk: `df -h /`
4. Review this troubleshooting guide

## 🔄 Rollback

If you need to rollback to SD 1.5:

```bash
# Kill current API
pkill -f upgraded-sdxl-api.py

# Start old API
nohup python3 working-sd-api.py > sd-api.log 2>&1 &
```

---

*Total estimated time: 25-45 minutes (including downloads)*

