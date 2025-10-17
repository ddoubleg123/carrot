# Vast.ai Disk Cleanup - Manual Instructions

## 🚨 Your disk is 100% full (40GB)

### What's Using Space:
- **2.2GB** - `/root/pytorch_wheels` - SAFE TO DELETE ✓
- **268MB** - `/root/.cache/pip` - SAFE TO DELETE ✓
- **581MB** - `/root/CodeFormer` - KEEP (face restoration)
- **64MB** - `/root/weights` - KEEP (model weights)
- **980KB** - `/root/setup.log` - SAFE TO DELETE ✓
- **~15-20GB** - `/root/.cache/huggingface` - KEEP (SDXL models)
- **Unknown** - `/srv/outputs` - Check for generated images (SAFE TO DELETE)

### Good News: Generated images are NOT eating disk space!
Your SDXL API converts images to base64 and sends them directly to the client.
They're then uploaded to Firebase Storage (Google Cloud), not saved on Vast.ai.
The only exception is the Ghibli worker which saves to `/srv/outputs` temporarily.

---

## Step 1: SSH into Vast.ai

```powershell
ssh -p 14688 root@ssh4.vast.ai
```

---

## Step 2: Run These Cleanup Commands

Copy and paste these one by one:

### Check current space
```bash
df -h /
```

### Delete PyTorch wheels (frees ~2.2GB)
```bash
rm -rf /root/pytorch_wheels
echo "Deleted PyTorch wheels"
```

### Clear pip cache (frees ~268MB)
```bash
rm -rf /root/.cache/pip
echo "Cleared pip cache"
```

### Delete setup log (frees ~1MB)
```bash
rm -f /root/setup.log
echo "Deleted setup.log"
```

### Clear apt cache (frees 100-500MB usually)
```bash
apt-get clean
echo "Cleared apt cache"
```

### Clear conda cache if exists
```bash
rm -rf /root/.cache/conda
echo "Cleared conda cache"
```

### Clear temp files
```bash
rm -rf /tmp/*
rm -rf /var/tmp/*
echo "Cleared temp files"
```

### Remove Python cache files
```bash
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null
echo "Cleared Python cache"
```

### Check space again
```bash
df -h /
```

---

## Expected Results

**Minimum space freed: ~2.5GB** (PyTorch wheels + pip + apt cache)

This should drop you from 100% to about 94% full, giving you breathing room.

---

## Step 3: Find What Else Is Using Space

```bash
# See all large directories
du -h --max-depth=1 /root | sort -rh

# Check HuggingFace cache size
du -sh /root/.cache/huggingface

# Find largest files
find /root -type f -size +100M -exec du -h {} + | sort -rh
```

---

## Step 4: Check for Generated Images (NEW!)

**Your SDXL API doesn't save images to disk, but check if the Ghibli worker does:**

```bash
# Check if generated images directory exists
du -sh /srv/outputs 2>/dev/null

# Count images
find /srv/outputs -name "*.png" -o -name "*.jpg" 2>/dev/null | wc -l

# If images exist and you want to clean them:
rm -rf /srv/outputs/*
```

**Expected:** This directory probably doesn't exist or is small. But worth checking!

---

## If You Need MORE Space (Advanced)

### Option 1: Clean old HuggingFace cache
```bash
# WARNING: Only do this if you know what you're doing
# This removes old cached model files
rm -rf /root/.cache/huggingface/hub/models--*/.git
```

### Option 2: Check for Docker
```bash
# If you have Docker installed
docker system prune -af --volumes
```

### Option 3: Remove old kernels/packages
```bash
apt-get autoremove -y
apt-get autoclean
```

---

## What NOT to Delete

- `/root/CodeFormer` - Face restoration models
- `/root/weights` - Model weights  
- `/root/.cache/huggingface/hub` - SDXL models (15-20GB, required!)
- `/root/upgraded-sdxl-api.py` - Your API script
- Any `.sh` setup scripts

---

## Quick Reference: One-Liner Cleanup

Run this single command for quick cleanup:

```bash
rm -rf /root/pytorch_wheels /root/.cache/pip /root/.cache/conda /root/setup.log && apt-get clean && rm -rf /tmp/* /var/tmp/* && df -h /
```

**Expected result:** Frees ~2.5GB minimum

---

## After Cleanup

Once done, verify your disk space:
```bash
df -h /
```

You should see something like:
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        40G   37G   3G   94% /
```

Instead of 100% full!

