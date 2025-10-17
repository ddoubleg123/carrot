# Second Vast.ai Server Deployment Guide

## 🎯 Overview

Deploy SDXL to your second Vast.ai server using the same SSH key as your existing server for simplified management.

## 📋 Prerequisites

- ✅ First Vast.ai server running (existing)
- ✅ Second Vast.ai server rented (m:34326 recommended)
- ✅ Same SSH key added to both servers
- ✅ SSH connection details for second server

## 🔧 Configuration

### Update Setup Script

Edit `setup-second-vast-server.ps1` with your actual server details:

```powershell
# Configuration - UPDATE THESE VALUES
$SECOND_SERVER_HOST = "ssh5.vast.ai"     # Your actual host
$SECOND_SERVER_PORT = "12345"            # Your actual port
```

**Where to find these values:**
- After renting the server, Vast.ai shows SSH connection details
- Host: Usually `sshX.vast.ai` or IP address
- Port: Usually a 5-digit number

## 🚀 Deployment Process

### Step 1: Test SSH Connection

```powershell
# Test connection to second server
ssh -p 12345 root@ssh5.vast.ai "echo 'SSH connection successful'"
```

### Step 2: Run Deployment Script

```powershell
# Execute the deployment
.\setup-second-vast-server.ps1
```

This script will:
1. ✅ Test SSH connection
2. ✅ Upload SDXL upgrade files
3. ✅ Execute disk cleanup (~5 minutes)
4. ✅ Install packages (~15 minutes)
5. ✅ Download SDXL models (~15 minutes)
6. ✅ Start the SDXL API

### Step 3: Monitor Progress

```bash
# SSH into second server and monitor logs
ssh -p 12345 root@ssh5.vast.ai
tail -f /root/sdxl-api.log
```

**Look for:**
- "Loading SDXL models..."
- "All models loaded successfully!"
- "SDXL API started on port 7860"

## 🔍 Verification

### Health Check

```bash
# Test second server health
curl http://localhost:7861/health

# Expected response:
{
  "status": "healthy",
  "models_loaded": true,
  "device": "cuda",
  "cuda_available": true,
  "gpu_info": {
    "gpu_name": "NVIDIA GeForce RTX 3090",
    "total_memory_gb": "24.00",
    "allocated_memory_gb": "14.23"
  }
}
```

### Image Generation Test

```bash
# Test image generation on second server
curl -X POST http://localhost:7861/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "professional headshot, studio lighting, photorealistic",
    "width": 1024,
    "height": 1024,
    "steps": 35,
    "use_hires_fix": true
  }'
```

## 🔌 Dual Server Setup

### SSH Tunnels

You'll need two SSH tunnels running simultaneously:

```powershell
# start-dual-tunnels.ps1
Write-Host "🚀 Starting dual SSH tunnels..."

# Server 1 (existing)
Start-Process -FilePath "ssh" -ArgumentList "-p", "14688", "root@ssh4.vast.ai", "-L", "7860:localhost:7860", "-N" -WindowStyle Hidden

# Server 2 (new)
Start-Process -FilePath "ssh" -ArgumentList "-p", "12345", "root@ssh5.vast.ai", "-L", "7861:localhost:7860", "-N" -WindowStyle Hidden

Write-Host "✅ Both tunnels active!"
Write-Host "Server 1: http://localhost:7860"
Write-Host "Server 2: http://localhost:7861"
```

### Environment Variables

```env
# In carrot/.env.local
VAST_AI_URL_PRIMARY=http://localhost:7860      # Server 1 (RTX 3090 Ti)
VAST_AI_URL_SECONDARY=http://localhost:7861    # Server 2 (RTX 3090)
```

## 🔄 Load Balancing Implementation

### API Route Update

Update your image generation API to use both servers:

```typescript
// carrot/src/app/api/img/route.ts
const servers = [
  process.env.VAST_AI_URL_PRIMARY,
  process.env.VAST_AI_URL_SECONDARY
];

let currentServerIndex = 0;

function getNextServer(): string {
  const server = servers[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % servers.length;
  return server;
}

async function generateWithFallback(prompt: string): Promise<string> {
  const primaryServer = getNextServer();
  
  try {
    const response = await fetch(`${primaryServer}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) throw new Error('Generation failed');
    
    const data = await response.json();
    return data.image;
    
  } catch (error) {
    // Fallback to other server
    const fallbackServer = servers.find(s => s !== primaryServer);
    const response = await fetch(`${fallbackServer}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    const data = await response.json();
    return data.image;
  }
}
```

## 📊 Performance Comparison

| Metric | Server 1 (RTX 3090 Ti) | Server 2 (RTX 3090) |
|--------|-------------------------|---------------------|
| **Generation Time** | ~30-45 seconds | ~35-50 seconds |
| **VRAM Usage** | ~14GB | ~14GB |
| **Concurrent Requests** | 1 | 1 |
| **Combined Capacity** | 2 requests simultaneously | 2 requests simultaneously |

## 💰 Cost Analysis

### Monthly Costs (24/7 operation)
- **Server 1:** ~$87/month (existing rate)
- **Server 2:** ~$87/month ($0.121/hr × 24 × 30)
- **Total:** ~$174/month

### Cost per Image
- **Single server:** ~$0.012-0.018 per image
- **Dual server:** ~$0.006-0.009 per image (due to parallel processing)

## 🔍 Monitoring & Maintenance

### Health Monitoring

```bash
# Check both servers
curl http://localhost:7860/health
curl http://localhost:7861/health

# Check GPU usage
ssh -p 14688 root@ssh4.vast.ai "nvidia-smi"
ssh -p 12345 root@ssh5.vast.ai "nvidia-smi"
```

### Log Monitoring

```bash
# Server 1 logs
ssh -p 14688 root@ssh4.vast.ai "tail -f /root/sdxl-api.log"

# Server 2 logs
ssh -p 12345 root@ssh5.vast.ai "tail -f /root/sdxl-api.log"
```

### Automatic Restart (Optional)

Create a monitoring script to restart servers if they fail:

```bash
#!/bin/bash
# monitor-servers.sh

check_server() {
  local port=$1
  local server_name=$2
  
  if ! curl -s http://localhost:$port/health > /dev/null; then
    echo "❌ $server_name is down, restarting..."
    ssh -p $port root@ssh${port}.vast.ai "pkill -f upgraded-sdxl-api.py && nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &"
  else
    echo "✅ $server_name is healthy"
  fi
}

check_server 7860 "Server 1"
check_server 7861 "Server 2"
```

## 🚨 Troubleshooting

### Common Issues

**SSH Connection Failed:**
```bash
# Check if instance is running
# Verify SSH key is added correctly
# Test with: ssh -p 12345 root@ssh5.vast.ai
```

**API Not Starting:**
```bash
# Check logs
ssh -p 12345 root@ssh5.vast.ai "cat /root/sdxl-api.log"

# Check disk space
ssh -p 12345 root@ssh5.vast.ai "df -h /"

# Restart API
ssh -p 12345 root@ssh5.vast.ai "pkill -f upgraded-sdxl-api.py && nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &"
```

**Models Not Loading:**
```bash
# Check if models downloaded
ssh -p 12345 root@ssh5.vast.ai "ls -la /root/.cache/huggingface/hub/"

# Check CUDA
ssh -p 12345 root@ssh5.vast.ai "python3 -c 'import torch; print(torch.cuda.is_available())'"
```

## ✅ Success Checklist

- [ ] Second server rented and running
- [ ] SSH connection working
- [ ] SDXL upgrade completed
- [ ] Health endpoint responding
- [ ] Image generation working
- [ ] Dual tunnels active
- [ ] Load balancer implemented
- [ ] Both servers generating images
- [ ] Fallback mechanism working

---

**Your dual-server setup provides 2x generation capacity with automatic failover!**
