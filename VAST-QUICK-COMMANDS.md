# Vast.ai Quick Commands Reference

## 🚀 One-Command Fix

```powershell
# Fix PyTorch compatibility + setup everything
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"

# If interrupted - just re-run! wget resumes automatically
```

## 🎮 Start/Stop API

```powershell
# Start API (interactive - see logs)
.\start-vast-upgraded-api.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"

# Start API (background)
.\start-vast-upgraded-api.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688" -Background
```

## 🔌 SSH & Tunnel

```powershell
# SSH into instance
ssh -p 14688 root@ssh4.vast.ai

# Setup tunnel for API
ssh -p 14688 -L 7860:localhost:7860 root@ssh4.vast.ai

# Setup tunnel + run command
ssh -p 14688 -L 7860:localhost:7860 root@ssh4.vast.ai "cd /root && python3 upgraded-sdxl-api.py"
```

## 📊 Check Status

```powershell
# Health check (once tunnel is running)
curl http://localhost:7860/health

# Or in browser
http://localhost:7860/health
```

```bash
# On Vast.ai instance - check PyTorch version
python3 -c "import torch; print(torch.__version__)"
# Should show: 2.0.1+cu118

# Check torchvision
python3 -c "import torchvision; print(torchvision.__version__)"
# Should show: 0.15.2+cu118

# Check GPU
nvidia-smi

# Check disk space
df -h
```

## 🛠️ Troubleshooting

```bash
# Re-run PyTorch setup (if version wrong)
bash /root/setup-sdxl-compatible-pytorch.sh

# Re-run full setup (if imports fail)
bash /root/setup-sdxl-full-compatible.sh

# View API logs (if started with -Background)
ssh -p 14688 root@ssh4.vast.ai
tmux attach -t sdxl
# Press Ctrl+B then D to detach

# Kill background API
ssh -p 14688 root@ssh4.vast.ai "tmux kill-session -t sdxl"

# Check if API is running
ssh -p 14688 root@ssh4.vast.ai "ps aux | grep python"
```

## 📦 Upload Files

```powershell
# Upload single file
scp -P 14688 local-file.py root@ssh4.vast.ai:/root/

# Upload multiple files
scp -P 14688 file1.py file2.py root@ssh4.vast.ai:/root/

# Download file from Vast
scp -P 14688 root@ssh4.vast.ai:/root/file.txt .
```

## 🧪 Test Generation

```powershell
# Health check
curl http://localhost:7860/health

# Quick test (using PowerShell)
$body = @{
    prompt = "professional headshot of a woman, detailed face"
    width = 1024
    height = 1024
    use_refiner = $true
    use_face_restoration = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7860/generate" -Method Post -Body $body -ContentType "application/json"
```

## 🎨 Frontend Test

```
http://localhost:3005/test-deepseek-images
```

Should show:
- ✅ Backend connected
- ✅ CodeFormer available
- ✅ RealESRGAN available

## 📏 Expected Versions

| Package | Version |
|---------|---------|
| torch | 2.0.1+cu118 |
| torchvision | 0.15.2+cu118 |
| torchaudio | 2.0.2+cu118 |
| diffusers | 0.x.x (latest) |
| transformers | 4.x.x (latest) |

## 💾 Disk Space

| Item | Size |
|------|------|
| PyTorch wheels | 3GB (temp) |
| CodeFormer | 500MB |
| RealESRGAN | 100MB |
| SDXL models | 15GB |
| **Total needed** | **20GB** |

## ⏱️ Timeline

| Step | Time |
|------|------|
| PyTorch download | 15-20 mins |
| Full setup | 10 mins |
| First SDXL download | 30-40 mins |
| **First run total** | **~60 mins** |
| Subsequent startups | <30 seconds |
| Image generation | 10-20s each |

## 🔗 Useful URLs

**Local:**
- API: http://localhost:7860
- Health: http://localhost:7860/health
- Frontend: http://localhost:3005/test-deepseek-images

**Vast.ai:**
- Dashboard: https://cloud.vast.ai/instances/
- SSH: ssh4.vast.ai:14688 (example port)

## 🆘 Emergency Commands

```bash
# Kill all Python processes
ssh -p 14688 root@ssh4.vast.ai "pkill python3"

# Free up disk space - remove PyTorch wheels after install
ssh -p 14688 root@ssh4.vast.ai "rm -rf /root/pytorch_wheels"

# Check what's using disk
ssh -p 14688 root@ssh4.vast.ai "du -sh /root/*"

# Restart from scratch (nuclear option)
ssh -p 14688 root@ssh4.vast.ai "rm -rf /root/CodeFormer /root/.cache/huggingface /root/weights"
```

## 📝 Common Workflows

### Initial Setup
```powershell
# 1. Run automated fix
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"

# 2. Start API with tunnel
ssh -p 14688 -L 7860:localhost:7860 root@ssh4.vast.ai "cd /root && python3 upgraded-sdxl-api.py"

# 3. Test frontend
# Open: http://localhost:3005/test-deepseek-images
```

### Daily Use
```powershell
# Start tunnel + API
ssh -p 14688 -L 7860:localhost:7860 root@ssh4.vast.ai "cd /root && python3 upgraded-sdxl-api.py"

# Generate images from frontend
# http://localhost:3005/test-deepseek-images
```

### Update API Code
```powershell
# 1. Upload new version
scp -P 14688 upgraded-sdxl-api.py root@ssh4.vast.ai:/root/

# 2. Restart API
# Press Ctrl+C to stop current instance
# Then re-run start command
```

## 🎯 Success Indicators

Setup is complete when you see:
- ✅ `torch.__version__ = 2.0.1+cu118`
- ✅ `torchvision.transforms.functional_tensor` imports
- ✅ API returns `codeformer_available: true`
- ✅ API returns `realesrgan_available: true`
- ✅ Frontend shows "Backend connected"
- ✅ Image generation works (10-20s)

## 📞 Where to Find Help

- Full guide: `PYTORCH-COMPATIBILITY-FIX.md`
- Setup scripts: `setup-sdxl-compatible-pytorch.sh`, `setup-sdxl-full-compatible.sh`
- Automation: `fix-vast-pytorch-compatible.ps1`
- API code: `upgraded-sdxl-api.py`

