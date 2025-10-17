# Vast.ai Cleanup - Quick Start

## 🚨 Problem: Disk 100% Full (40GB)

## ⚡ Quick Fix (30 seconds)

SSH into Vast.ai:
```bash
ssh -p 14688 root@ssh4.vast.ai
```

Then run this ONE command:
```bash
rm -rf /root/pytorch_wheels /root/.cache/pip /root/.cache/conda /root/setup.log /srv/outputs/* && apt-get clean && rm -rf /tmp/* /var/tmp/* && find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null && df -h /
```

**Expected Result:** Frees ~2.5GB (drops from 100% to 93-94% full)

---

## 📊 What Gets Deleted

| Item | Size | Why Delete |
|------|------|------------|
| `/root/pytorch_wheels` | 2.2GB | Installation files (already installed) |
| `/root/.cache/pip` | 268MB | Package cache (rebuilds automatically) |
| `/root/.cache/conda` | ~50MB | Conda cache (not needed) |
| `/srv/outputs/*` | Variable | Generated images (already uploaded to Firebase) |
| `/tmp/*` | Variable | Temporary files |
| Python cache | ~10MB | `__pycache__` directories |
| APT cache | ~100MB | Package manager cache |

---

## ✅ What's KEPT (Important!)

| Item | Size | Why Keep |
|------|------|----------|
| `/root/.cache/huggingface` | 15-20GB | **SDXL models** - required for image generation |
| `/root/CodeFormer` | 581MB | Face restoration model |
| `/root/weights` | 64MB | Model weights |
| `upgraded-sdxl-api.py` | <1MB | Your API script |

---

## 🔍 Where Are Generated Images Stored?

### Vast.ai Server (where disk is full):
- **SDXL API:** Images generated → base64 → sent to client → **NOT saved to disk** ✅
- **Ghibli Worker:** Saves temporarily to `/srv/outputs/` (can be deleted)

### Firebase Storage (Google Cloud):
- Final images uploaded to: `users/${userId}/posts/`
- **Not on Vast.ai server** ✅

**Bottom line:** Generated images are NOT causing your disk space problem!

---

## 🆘 If You Need Even More Space

After the quick cleanup, if still low on space:

```bash
# Find what's using space
du -h --max-depth=1 /root | sort -rh | head -10

# Check HuggingFace cache size
du -sh /root/.cache/huggingface

# Find large files
find /root -type f -size +100M -exec du -h {} + | sort -rh | head -10
```

Then report back what you find!

---

## 📝 Or Use the Automated Script

Upload the comprehensive cleanup script:
```bash
# On your local machine:
scp -P 14688 vast-cleanup-comprehensive.sh root@ssh4.vast.ai:/root/

# On Vast.ai:
bash /root/vast-cleanup-comprehensive.sh
```

---

## ✅ Success Indicators

After cleanup, you should see:
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        40G   37G   3G   94% /
```

Instead of:
```
/dev/sda1        40G   40G   0    100% /
```

You'll have 2-3GB of breathing room for AI generation!

