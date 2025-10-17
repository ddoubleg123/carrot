# Quick Connection Guide - Fix "Stuck" Image Generation

## The Problem
Your image generation is stuck because the frontend can't reach the SDXL API running on Vast.ai.

## The Solution - 3 Steps

### Step 1: Start the SSH Tunnel
Run this in PowerShell:
```powershell
.\start-vast-tunnel.ps1
```

This creates a tunnel from `localhost:7860` → Vast.ai SDXL API.

**Note:** Update the script with your current Vast.ai IP and port if they've changed!

### Step 2: Verify the Connection
Run this in PowerShell:
```powershell
.\test-vast-connection.ps1
```

You should see:
```
✅ Connection successful!
API Health Status:
  Status: healthy
  Model Loaded: True
  CUDA Available: True
  ...
```

### Step 3: Test Image Generation
Now go to your Next.js app and try generating an image again:
- http://localhost:3005/test-deepseek-images

## Troubleshooting

### "Connection failed"
- Check if your Vast.ai instance is running
- Verify the IP and port in `start-vast-tunnel.ps1`
- Make sure SSH is working: `ssh -p 45583 root@171.247.185.4`

### "Model Loaded: False"
- Models are still loading on Vast.ai
- Wait 2-3 minutes and test again
- Check Vast.ai logs

### "Port already in use"
- Kill existing SSH tunnel: `Get-Process | Where-Object {$_.Name -eq "ssh"} | Stop-Process`
- Then restart the tunnel

## Environment Variable
Make sure your `.env.local` has:
```
VAST_AI_URL=http://localhost:7860
```

This tells the frontend where to find the SDXL API.

