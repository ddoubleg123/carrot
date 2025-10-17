# SDXL Deployment Plan - Upgrade from SD v1.5 to SDXL

## Executive Summary

**Current State:** Stable Diffusion v1.5 running on Vast.ai (RTX 3090 Ti)  
**Target State:** SDXL Base + Refiner with improved quality and resolution  
**Estimated Downtime:** 10-15 minutes  
**Estimated Download Time:** 20-30 minutes (models download in background)  
**Total Storage Required:** ~15GB additional space

---

## Pre-Deployment Checklist

### ✅ Current Working Configuration
- [x] Vast.ai Instance: RTX 3090 Ti (Instance ID: 26749354)
- [x] SSH Access: Port 45583, IP 171.247.185.4
- [x] Current API: `working-sd-api.py` running on port 7860
- [x] SSH Tunnel: Active on local machine
- [x] App Integration: Working via `carrot/src/lib/media/aiImageGenerator.ts`

### 📊 System Requirements Verification

**Minimum Requirements:**
- ✅ GPU VRAM: 24GB (RTX 3090 Ti has 24GB)
- ⚠️  Disk Space: Need to verify ~25GB free (15GB for SDXL + 10GB buffer)
- ✅ CUDA: 12.8 (compatible)
- ✅ PyTorch: 2.5.1 (compatible)

**Action Item:** Verify disk space before proceeding

---

## Deployment Strategy

### Phase 1: Preparation & Backup (5 minutes)
1. **Verify system resources** (disk space, VRAM, running processes)
2. **Backup current configuration** (save `working-sd-api.py` state)
3. **Test current API** (ensure baseline is working)
4. **Upload new SDXL script** to Vast.ai instance

### Phase 2: Deployment (10-15 minutes)
1. **Stop current SD v1.5 service**
2. **Install additional dependencies** (if needed)
3. **Start SDXL service** (models will auto-download on first run)
4. **Monitor startup logs** for model loading progress
5. **Wait for "Model loaded successfully" message**

### Phase 3: Verification (5 minutes)
1. **Health check** - Verify SDXL API responds
2. **Test generation** - Generate sample image
3. **Compare quality** - SD v1.5 vs SDXL side-by-side
4. **Performance test** - Measure generation time
5. **Verify SSH tunnel** still forwards correctly

### Phase 4: Integration (5 minutes)
1. **No code changes needed** - SDXL API uses same endpoints
2. **Test from application** - Generate image via app
3. **Monitor for errors** in application logs
4. **Verify base64 image encoding** works correctly

---

## Detailed Technical Plan

### 1. Pre-Deployment Commands

```bash
# SSH into Vast.ai
ssh -p 45583 root@171.247.185.4

# Check disk space (need ~25GB free)
df -h

# Check current process
ps aux | grep sd-api

# Check current API health
curl http://localhost:7860/health

# Expected output:
# {"status":"healthy","model_loaded":true,"cuda_available":true}
```

### 2. Backup Current Setup

```bash
# Create backup directory
mkdir -p /root/backups/sd-v15-$(date +%Y%m%d-%H%M%S)

# Backup current API script
cp /root/working-sd-api.py /root/backups/sd-v15-$(date +%Y%m%d-%H%M%S)/

# Save current process info
ps aux | grep sd-api > /root/backups/sd-v15-$(date +%Y%m%d-%H%M%S)/process.txt

# Save current logs
cp /tmp/sd-api.log /root/backups/sd-v15-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true
```

### 3. Upload New SDXL Script

```powershell
# From local machine (Windows PowerShell)
scp -P 45583 upgraded-sdxl-api.py root@171.247.185.4:/root/
```

### 4. Install Dependencies (if needed)

```bash
# On Vast.ai instance
# SDXL uses same dependencies as SD v1.5, but verify versions
pip list | grep -E "(torch|diffusers|transformers|accelerate)"

# Expected versions (already installed from SD v1.5 setup):
# torch==2.5.1
# diffusers==0.35.1
# transformers==4.57.0
# accelerate==1.10.1

# If any are missing or wrong version:
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121
pip install diffusers==0.35.1 transformers==4.57.0 accelerate==1.10.1 safetensors==0.6.2
```

### 5. Stop Current Service & Start SDXL

```bash
# Stop SD v1.5
pkill -f working-sd-api.py

# Wait for process to stop
sleep 2

# Verify stopped
ps aux | grep sd-api

# Start SDXL API
nohup python3 /root/upgraded-sdxl-api.py > /tmp/sdxl-api.log 2>&1 &

# Save PID
echo $! > /root/sdxl-api.pid

# Initial check
echo "Waiting for startup..."
sleep 5
```

### 6. Monitor Startup Progress

```bash
# Watch logs in real-time
tail -f /tmp/sdxl-api.log

# You should see:
# 🚀 Starting SDXL + CodeFormer API...
# 🚀 Loading VAE model...
# ✅ VAE loaded
# 🚀 Loading SDXL Base model...
# Downloading: 100% [this will take 10-15 minutes]
# ✅ SDXL Base model loaded successfully
# 🚀 Loading SDXL Refiner model...
# Downloading: 100% [this will take 10-15 minutes]
# ✅ SDXL Refiner model loaded successfully
# 🎮 GPU: NVIDIA GeForce RTX 3090 Ti
# 🎮 VRAM: XX.XGB / 24.0GB

# Wait for "Model loaded successfully" before proceeding
```

### 7. Verify SDXL Health

```bash
# Check health endpoint
curl http://localhost:7860/health

# Expected response:
# {
#   "status": "healthy",
#   "model_loaded": true,
#   "cuda_available": true,
#   "codeformer_available": false,
#   "vram_available": "XX.XGB / 24.0GB"
# }
```

### 8. Test Image Generation

```bash
# Generate test image
curl -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional basketball player shooting a three pointer",
    "num_inference_steps": 20,
    "width": 1024,
    "height": 1024,
    "use_refiner": true,
    "use_face_restoration": false,
    "hires_fix": false
  }' | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Success: {data.get(\"success\")}'); print(f'Image length: {len(data.get(\"image\", \"\"))}'); print(f'Resolution: {data.get(\"final_resolution\")}')"

# Expected output:
# Success: True
# Image length: 1500000+ (larger than SD v1.5 due to higher resolution)
# Resolution: 1024x1024
```

### 9. Verify SSH Tunnel & Application Integration

```powershell
# From local machine (Windows PowerShell)
# Test through SSH tunnel
Invoke-WebRequest -Uri http://localhost:7860/health -Method GET

# Expected: Status 200 with JSON response

# No application code changes needed!
# The app will automatically use SDXL since it calls the same endpoint
```

---

## Key Differences: SD v1.5 vs SDXL

| Feature | SD v1.5 (Current) | SDXL (Upgraded) |
|---------|-------------------|-----------------|
| **Resolution** | 512x512 | 1024x1024 |
| **Model Size** | ~4GB | ~14GB |
| **Quality** | Good | Excellent |
| **Detail** | Moderate | High |
| **Generation Time** | ~5-10s | ~10-20s |
| **VRAM Usage** | ~6GB | ~12-16GB |
| **Refiner** | No | Yes (optional) |
| **API Endpoints** | `/generate`, `/health` | **Same** ✅ |

---

## Rollback Plan

If anything goes wrong, you can quickly rollback:

```bash
# Stop SDXL
pkill -f upgraded-sdxl-api.py

# Restart SD v1.5
nohup python3 /root/working-sd-api.py > /tmp/sd-api.log 2>&1 &

# Verify
curl http://localhost:7860/health
```

**Rollback Time:** < 1 minute  
**Data Loss:** None (models cached, can retry anytime)

---

## Expected Improvements

### Quality Enhancements
- ✨ **2x Higher Resolution** (512→1024px)
- 🎨 **Better Details** (faces, hands, text)
- 🌈 **Improved Colors** and lighting
- 📸 **More Photorealistic** outputs
- 🔧 **Refiner Pipeline** for extra polish

### Performance Considerations
- ⏱️ **Generation Time** will increase (~2x)
- 💾 **VRAM Usage** will increase (~2x)
- 📦 **Image File Size** will increase (~4x)
- ⚡ **First Request** will be slow (model loading)

---

## Troubleshooting Guide

### Issue: Disk Space Error
**Symptom:** `OSError: [Errno 28] No space left on device`

**Solution:**
```bash
# Check space
df -h

# Clean up old logs and caches
rm -rf ~/.cache/huggingface/hub/models--runwayml*
rm -f /tmp/*.log

# If still not enough, rent larger instance or cleanup old models
```

### Issue: CUDA Out of Memory
**Symptom:** `RuntimeError: CUDA out of memory`

**Solution:**
```bash
# In upgraded-sdxl-api.py, reduce batch size or use CPU offload
# Already implemented with enable_attention_slicing() and enable_vae_slicing()
```

### Issue: Model Download Fails
**Symptom:** `HTTPError: 503 Server Error`

**Solution:**
```bash
# HuggingFace may be rate-limiting or down
# Wait 5 minutes and retry
# Verify not in China region (HuggingFace blocked)
```

### Issue: Generation Too Slow
**Symptom:** Takes > 30 seconds per image

**Solution:**
```bash
# Reduce num_inference_steps from 25 to 15-20
# Disable refiner: use_refiner=false
# Reduce resolution to 768x768 instead of 1024x1024
```

---

## Cost Analysis

### Vast.ai Costs
- **Current:** ~$0.40/hour (RTX 3090 Ti)
- **After SDXL:** Same hardware, same cost
- **Recommendation:** Keep on-demand, not 24/7 ($290/month)

### Performance vs Cost
- **SD v1.5:** ~$0.001 per image (~10s @ $0.40/hr)
- **SDXL:** ~$0.002 per image (~20s @ $0.40/hr)
- **Quality Gain:** 3-4x better quality for 2x cost

---

## Success Criteria

Before marking deployment as complete, verify:

- [ ] ✅ Health endpoint returns `model_loaded: true`
- [ ] ✅ Can generate 1024x1024 image successfully
- [ ] ✅ Generation completes in < 30 seconds
- [ ] ✅ Base64 image is valid and loads in browser
- [ ] ✅ SSH tunnel still works from local machine
- [ ] ✅ Application can generate images via API
- [ ] ✅ No CUDA errors in logs
- [ ] ✅ VRAM usage < 20GB (safe margin on 24GB GPU)
- [ ] ✅ Quality visibly better than SD v1.5

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Preparation** | 5 min | Verify resources, backup current setup |
| **Deployment** | 10-15 min | Stop old, start new service |
| **Model Download** | 20-30 min | Automatic on first request |
| **Verification** | 5 min | Health checks and test generation |
| **Total** | **40-55 min** | From start to fully operational |

---

## Next Steps

1. ✅ Review this deployment plan
2. ✅ Run automated deployment script (to be created)
3. ✅ Monitor deployment progress
4. ✅ Test and verify quality improvements
5. ✅ Update documentation with results

---

## Automated Deployment

We will create three scripts:

1. **`deploy-sdxl.sh`** - Main deployment script
2. **`verify-sdxl.sh`** - Health check and testing
3. **`rollback-sdxl.sh`** - Rollback to SD v1.5 if needed

These scripts will be created next and automate all the manual steps above.

---

## Notes from Current Setup

- ✅ Your current SD v1.5 setup is working well
- ✅ SDXL will be a drop-in replacement (same API endpoints)
- ✅ No application code changes required
- ⚠️  First generation after deployment will be slower (model caching)
- ⚠️  Monitor disk space - SDXL needs ~15GB

---

## Questions & Decisions

### Q: Should we enable CodeFormer face restoration?
**A:** Start with it disabled. Can enable later if needed. Requires additional setup.

### Q: Should we always use the refiner?
**A:** Make it optional (default: true). Can disable for faster generation.

### Q: What resolution should we default to?
**A:** 1024x1024 for best quality, but allow 768x768 for faster generation.

### Q: Should we keep SD v1.5 available?
**A:** Keep `working-sd-api.py` as backup. Can run both on different ports if needed.

---

## Ready to Deploy?

Once you approve this plan, we will:
1. ✅ Create automated deployment scripts
2. ✅ Execute deployment on Vast.ai
3. ✅ Verify and test SDXL
4. ✅ Document results and update integration guide

