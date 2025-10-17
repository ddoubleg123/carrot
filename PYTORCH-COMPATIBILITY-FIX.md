# PyTorch Compatibility Fix for CodeFormer/RealESRGAN

## Problem
CodeFormer and RealESRGAN require `torchvision.transforms.functional_tensor`, which was removed in newer PyTorch versions.

**Current versions (broken):**
- torch: 2.5.1
- torchvision: 0.20.1

**Required versions (compatible):**
- torch: 2.0.1+cu118
- torchvision: 0.15.2+cu118
- torchaudio: 2.0.2+cu118

## Solution: Robust Download + Install

### Why the Previous Approach Failed
Downloading 2.3GB PyTorch wheel via `pip` over SSH times out on unstable connections.

### New Approach: wget with Resume
Uses `wget -c` (resume capability) to download wheels directly, then installs locally.

**Benefits:**
- ✅ Resume interrupted downloads
- ✅ Better progress tracking
- ✅ More reliable over slow/unstable connections
- ✅ Can re-run safely - picks up where it left off

## Quick Start

### Option 1: Automated (Recommended)

```powershell
# From your local machine - runs everything automatically
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"
```

This will:
1. Upload both setup scripts
2. Upload the API script
3. Download PyTorch 2.0.1 (resumable)
4. Install everything
5. Verify installation

**If download is interrupted:**
Just re-run the same command - wget will resume!

### Option 2: Manual Steps

**Step 1: Upload scripts**
```powershell
scp -P 14688 setup-sdxl-compatible-pytorch.sh root@ssh4.vast.ai:/root/
scp -P 14688 setup-sdxl-full-compatible.sh root@ssh4.vast.ai:/root/
scp -P 14688 upgraded-sdxl-api.py root@ssh4.vast.ai:/root/
```

**Step 2: SSH into Vast.ai**
```bash
ssh -p 14688 root@ssh4.vast.ai
```

**Step 3: Run PyTorch downgrade**
```bash
cd /root
chmod +x setup-sdxl-compatible-pytorch.sh
bash setup-sdxl-compatible-pytorch.sh
```

This downloads:
- torch-2.0.1 (2.3GB) - 10-15 mins
- torchvision-0.15.2 (700MB) - 3-5 mins
- torchaudio-2.0.2 (50MB) - <1 min

**If interrupted:** Just re-run the command - wget resumes!

**Step 4: Run full setup**
```bash
chmod +x setup-sdxl-full-compatible.sh
bash setup-sdxl-full-compatible.sh
```

This installs:
- diffusers, transformers, etc.
- BasicSR, facexlib
- CodeFormer + weights
- RealESRGAN + weights

**Step 5: Start API**
```bash
python3 upgraded-sdxl-api.py
```

Or from local machine:
```powershell
.\start-vast-upgraded-api.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"
```

## Verification

After setup completes, you should see:
```
✅ All imports successful!
   PyTorch: 2.0.1+cu118
   torchvision: 0.15.2+cu118
   Diffusers: 0.x.x
   CUDA: True
   GPU: NVIDIA GeForce RTX 4090
✅ torchvision.transforms.functional_tensor available!
```

## Troubleshooting

### Download Stuck/Timeout
**Solution:** Re-run the script - wget resumes automatically
```bash
bash setup-sdxl-compatible-pytorch.sh
```

### Wrong PyTorch Version
**Check version:**
```bash
python3 -c "import torch; print(torch.__version__)"
```

**Should show:** `2.0.1+cu118`

**If not:** Re-run PyTorch setup:
```bash
bash setup-sdxl-compatible-pytorch.sh
```

### CodeFormer Import Fails
**Check if functional_tensor exists:**
```python
from torchvision.transforms.functional_tensor import rgb_to_grayscale
```

**If fails:** PyTorch version is wrong - see above

### Out of Disk Space
**Check usage:**
```bash
df -h
du -sh /root/CodeFormer
du -sh /root/.cache/huggingface
```

**Requirements:**
- PyTorch wheels: 3GB (can delete after install)
- CodeFormer: 500MB
- SDXL models: 15GB
- Total needed: ~20GB

## Files Created

### On Vast.ai (`/root/`)
- `setup-sdxl-compatible-pytorch.sh` - PyTorch downgrade script
- `setup-sdxl-full-compatible.sh` - Full SDXL setup script
- `upgraded-sdxl-api.py` - API server
- `pytorch_wheels/` - Downloaded wheels (can delete after install)
- `CodeFormer/` - Face restoration model
- `weights/` - RealESRGAN weights
- `.cache/huggingface/` - SDXL models (15GB)

### On Local Machine
- `fix-vast-pytorch-compatible.ps1` - Automated setup
- `start-vast-upgraded-api.ps1` - Start API
- `setup-sdxl-compatible-pytorch.sh` - PyTorch script (uploaded)
- `setup-sdxl-full-compatible.sh` - Full setup script (uploaded)

## Expected Timeline

### First Run (Fresh Install)
1. PyTorch download: 15-20 mins
2. PyTorch install: 2-3 mins
3. Dependencies install: 5 mins
4. CodeFormer setup: 3-5 mins
5. RealESRGAN setup: 1-2 mins
6. SDXL models (first API start): 30-40 mins

**Total:** ~60 mins

### After First Run
- API startup: <30 seconds (models cached)
- Generation time: 10-20s per image

## Next Steps

After setup completes:

1. **Start API:**
   ```powershell
   .\start-vast-upgraded-api.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"
   ```

2. **Setup tunnel** (if not already running):
   ```powershell
   ssh -p 14688 -L 7860:localhost:7860 root@ssh4.vast.ai
   ```

3. **Test from browser:**
   ```
   http://localhost:7860/health
   http://localhost:3005/test-deepseek-images
   ```

4. **Generate images!**
   - Frontend at `http://localhost:3005/test-deepseek-images`
   - Should see: `codeformer_available: true`
   - Should see: `realesrgan_available: true`

## What This Fixes

✅ Missing `torchvision.transforms.functional_tensor`
✅ CodeFormer face restoration
✅ RealESRGAN neural upscaling
✅ Hires Fix (768→1536)
✅ All SDXL features

## References

- PyTorch wheels: https://download.pytorch.org/whl/cu118/
- CodeFormer: https://github.com/sczhou/CodeFormer
- RealESRGAN: https://github.com/xinntao/Real-ESRGAN

