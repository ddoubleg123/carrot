# Fix PyTorch NOW - Simple Instructions

## 🎯 Your Current Situation

✅ Frontend working: http://localhost:3005/test-deepseek-images
✅ SDXL models cached on Vast.ai
❌ **BLOCKER:** PyTorch 2.5.1 is too new - breaks CodeFormer/RealESRGAN

## 🚀 The Fix (3 Simple Steps)

### Step 1: Get Your Vast.ai SSH Info

Find your SSH connection string. It looks like:
```
ssh://root@ssh4.vast.ai:14688
```

You can find this on your Vast.ai dashboard or from your previous SSH commands.

### Step 2: Run ONE Command

Open PowerShell in your project folder and run:

```powershell
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:YOUR_PORT"
```

**Replace `YOUR_PORT` with your actual port number!**

Example:
```powershell
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:14688"
```

### Step 3: Wait (~20-30 minutes)

The script will:
- ⬆️  Upload setup scripts (30 seconds)
- ⬇️  Download PyTorch 2.0.1 (15-20 minutes)
- 🔧 Install everything (10 minutes)
- ✅ Verify it works

**Don't close the window!** Let it finish.

## ⚡ If Download Gets Interrupted

**Don't panic!** Just run the same command again:
```powershell
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:YOUR_PORT"
```

It will **resume from where it left off** - you won't lose progress!

## ✅ How to Know It Worked

When done, you'll see:
```
🎉 Setup Complete!
✅ All imports successful!
   PyTorch: 2.0.1+cu118
   torchvision: 0.15.2+cu118
✅ torchvision.transforms.functional_tensor available!
```

## 🎨 Start Using It

After setup completes:

**Option A: Simple (run in PowerShell)**
```powershell
ssh -p YOUR_PORT -L 7860:localhost:7860 root@ssh4.vast.ai "cd /root && python3 upgraded-sdxl-api.py"
```

**Option B: Even Simpler (use the script)**
```powershell
.\start-vast-upgraded-api.ps1 -VastSSH "ssh://root@ssh4.vast.ai:YOUR_PORT"
```

Then open: http://localhost:3005/test-deepseek-images

## 🎉 What You Get

After this fix:
- ✅ **CodeFormer** - Professional face restoration
- ✅ **RealESRGAN** - AI neural upscaling (2x better quality)
- ✅ **Hires Fix** - Two-pass generation (768→1536 resolution)
- ✅ **Seed Support** - Reproducible results

Your images will look MUCH better!

## 🆘 Need Help?

### "I don't know my SSH port"
Check your Vast.ai dashboard under "Instance Details" or look at previous SSH commands you've run.

### "Download is too slow"
That's normal - 2.3GB file. It takes 15-20 minutes even on good connections.
**Don't worry - if it gets interrupted, you can resume!**

### "Script says 'command not found'"
Make sure you're in the project folder:
```powershell
cd C:\Users\danie\CascadeProjects\windsurf-project
```

### "Permission denied"
Your SSH key might not be configured. Try:
```powershell
ssh -p YOUR_PORT root@ssh4.vast.ai
# If this works, the script will too
```

### "Still getting errors"
Check the detailed guides:
- `PYTORCH-COMPATIBILITY-FIX.md` - Full documentation
- `VAST-QUICK-COMMANDS.md` - All commands explained
- `PYTORCH-FIX-SUMMARY.md` - Visual overview

## 📝 Quick Reference

| What | Command |
|------|---------|
| **Fix PyTorch** | `.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:PORT"` |
| **Start API** | `.\start-vast-upgraded-api.ps1 -VastSSH "ssh://root@ssh4.vast.ai:PORT"` |
| **Test Frontend** | Open `http://localhost:3005/test-deepseek-images` |

## 🎯 Bottom Line

**Run this ONE command:**
```powershell
.\fix-vast-pytorch-compatible.ps1 -VastSSH "ssh://root@ssh4.vast.ai:YOUR_PORT"
```

**Wait 20-30 minutes.**

**Done!**

---

**Questions?** Read `PYTORCH-COMPATIBILITY-FIX.md` for full details.

**Ready?** Open PowerShell and run the command above! 🚀

