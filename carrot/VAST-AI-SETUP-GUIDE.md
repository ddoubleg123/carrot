# 🚀 Vast.ai Stable Diffusion Setup Guide

## Quick Start

### Step 1: Access Your Vast.ai Instance

You have two options to run the setup script:

#### Option A: SSH from Windows PowerShell
```powershell
ssh -p 44302 root@83.10.113.244
```

#### Option B: Use Vast.ai Web Terminal
1. Go to https://cloud.vast.ai/instances/
2. Click on your RTX 5070 instance
3. Click "Open SSH Terminal" button
4. You'll get a web-based terminal

### Step 2: Run the Setup Script

Once connected to your instance, run these commands:

```bash
# Download the setup script
wget https://raw.githubusercontent.com/YOUR-REPO/carrot/main/vast-ai-setup.sh

# Make it executable
chmod +x vast-ai-setup.sh

# Run the setup
./vast-ai-setup.sh
```

**OR** if you can't use wget, copy the script manually:

```bash
# Create the file
nano vast-ai-setup.sh

# Paste the entire contents from carrot/vast-ai-setup.sh
# Press Ctrl+X, then Y, then Enter to save

# Make it executable
chmod +x vast-ai-setup.sh

# Run it
./vast-ai-setup.sh
```

### Step 3: Wait for Installation (15-30 minutes)

The script will:
- ✅ Install all dependencies
- ✅ Clone AUTOMATIC1111 WebUI
- ✅ Download Stable Diffusion v1.5 model (~4GB)
- ✅ Set up systemd service for auto-restart
- ✅ Start the WebUI API

### Step 4: Test the API

After installation, test the API:

```bash
curl http://localhost:7860/sdapi/v1/txt2img \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful basketball player in action",
    "steps": 20,
    "width": 1280,
    "height": 720
  }'
```

### Step 5: Verify from Your Local Machine

Test the API from your Windows machine:

```powershell
$body = '{
  "prompt": "Derrick Rose playing basketball in Chicago Bulls jersey",
  "steps": 20,
  "width": 1280,
  "height": 720
}'

Invoke-WebRequest -Uri "http://83.10.113.244:7860/sdapi/v1/txt2img" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

## Environment Variables

### Local Development (.env.local)
```
VAST_AI_URL=http://83.10.113.244:7860
```

### Render Production
Already configured! ✅
```
VAST_AI_URL=http://83.10.113.244:7860
```

## Useful Commands

### Check Service Status
```bash
systemctl status stable-diffusion
```

### View Live Logs
```bash
journalctl -u stable-diffusion -f
```

### Restart Service
```bash
systemctl restart stable-diffusion
```

### Stop Service
```bash
systemctl stop stable-diffusion
```

### Check GPU Usage
```bash
nvidia-smi
```

### Test API Health
```bash
curl http://localhost:7860/sdapi/v1/sd-models
```

## Troubleshooting

### Issue: Service won't start
**Solution:** Check logs
```bash
journalctl -u stable-diffusion -n 50
```

### Issue: Out of memory
**Solution:** Reduce image size or add swap
```bash
# Add 8GB swap
fallocate -l 8G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

### Issue: API not responding
**Solution:** Restart the service
```bash
systemctl restart stable-diffusion
```

## Cost Tracking

**RTX 5070 Instance:**
- **Hourly:** $0.094/hr
- **Daily:** ~$2.26/day
- **Monthly:** ~$68/month

**Model Downloads (one-time):**
- Stable Diffusion v1.5: ~4GB
- Total setup time: 15-30 minutes

## Next Steps

1. ✅ Run `vast-ai-setup.sh` on your instance
2. ✅ Wait for installation to complete
3. ✅ Test API endpoint from your local machine
4. ✅ Deploy your updated Carrot code to Render
5. ✅ Test hero image generation on production

## Security Notes

⚠️ **Important:** Your Vast.ai instance is publicly accessible on port 7860. Consider:
- Using a firewall to restrict access
- Implementing API authentication
- Using a VPN or proxy for production

For now, the API is open for testing purposes.

## Additional Resources

- [AUTOMATIC1111 Wiki](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki)
- [Stable Diffusion Models](https://huggingface.co/models?pipeline_tag=text-to-image)
- [Vast.ai Documentation](https://vast.ai/docs/gpu-instances/quickstart)

