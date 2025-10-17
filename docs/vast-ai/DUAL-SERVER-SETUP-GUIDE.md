# Dual Vast.ai Server Setup Guide

## 🎯 Overview

You'll have **two Vast.ai servers** running SDXL:
- **Server 1:** Your existing RTX 3090 Ti (after upgrade)
- **Server 2:** New RTX 3090 (fresh SDXL installation)

## 🔑 SSH Key Strategy: Option 1 - Same SSH Key

**Using your existing SSH key** - simpler and easier to manage:
- ✅ One key to manage
- ✅ Same access pattern for both servers
- ✅ Faster setup
- ✅ No additional key generation needed

## 🚀 Setup Process

### Step 1: Rent Second Server

1. **Go to Vast.ai marketplace**
2. **Select server m:34326 (Guangxi, CN)** - RTX 3090, 1.3TB storage
3. **Add your existing SSH public key** to the instance
4. **Start the instance**
5. **Note the SSH connection details** (host, port)

### Step 2: Configure Connection Details

Update `setup-second-vast-server.ps1` with your new server details:

```powershell
# Edit these variables with your actual server details
$SECOND_SERVER_HOST = "ssh5.vast.ai"  # Your actual host
$SECOND_SERVER_PORT = "12345"         # Your actual port
```

### Step 3: Deploy SDXL to Second Server

```powershell
# Run the setup script
.\setup-second-vast-server.ps1
```

This will:
1. Test SSH connection
2. Upload all SDXL upgrade files
3. Execute disk cleanup
4. Install all packages
5. Start the SDXL API

## 📊 Server Comparison

| Feature | Server 1 (Existing) | Server 2 (New) |
|---------|---------------------|-----------------|
| **GPU** | RTX 3090 Ti | RTX 3090 |
| **VRAM** | 24GB | 24GB |
| **Storage** | 40GB | 1,341GB |
| **DLPerf** | ~46.5 | 45.4 |
| **Status** | Needs SDXL upgrade | Fresh SDXL install |
| **SSH Key** | Same as Server 1 | Same as Server 1 |
| **Cost** | Current rate | $0.121/hr |

## 🔌 SSH Tunnel Setup

You'll need **two SSH tunnels** for local development:

### PowerShell Script (Both Tunnels)

```powershell
# start-dual-tunnels.ps1
Write-Host "🚀 Starting dual SSH tunnels..."

# Start tunnel for server 1 (existing)
Start-Process -FilePath "ssh" -ArgumentList "-p", "14688", "root@ssh4.vast.ai", "-L", "7860:localhost:7860", "-N" -WindowStyle Hidden

# Start tunnel for server 2 (new)
Start-Process -FilePath "ssh" -ArgumentList "-p", "12345", "root@ssh5.vast.ai", "-L", "7861:localhost:7860", "-N" -WindowStyle Hidden

Write-Host "✅ Both tunnels started!"
Write-Host "Server 1: http://localhost:7860"
Write-Host "Server 2: http://localhost:7861"
```

### Manual Tunnels (Terminal)

**Terminal 1 (Server 1):**
```bash
ssh -p 14688 root@ssh4.vast.ai -L 7860:localhost:7860
```

**Terminal 2 (Server 2):**
```bash
ssh -p 12345 root@ssh5.vast.ai -L 7861:localhost:7860
```

## 🔄 Load Balancing Setup

Once both servers are running SDXL:

### Environment Variables

```env
# In your .env.local
VAST_AI_URL_PRIMARY=http://localhost:7860      # Server 1
VAST_AI_URL_SECONDARY=http://localhost:7861    # Server 2 (via tunnel)
```

### API Load Balancer

Create `carrot/src/lib/loadBalancer.ts`:

```typescript
class ImageGenerationLoadBalancer {
  private servers = [
    process.env.VAST_AI_URL_PRIMARY,
    process.env.VAST_AI_URL_SECONDARY
  ];
  
  private currentIndex = 0;
  
  getNextServer(): string {
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }
  
  async generateImage(prompt: string): Promise<string> {
    const server = this.getNextServer();
    
    try {
      const response = await fetch(`${server}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) throw new Error('Generation failed');
      
      const data = await response.json();
      return data.image;
      
    } catch (error) {
      // Fallback to other server
      const fallbackServer = this.servers.find(s => s !== server);
      const response = await fetch(`${fallbackServer}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      return data.image;
    }
  }
}
```

## 🧪 Testing Both Servers

```bash
# Test server 1
curl http://localhost:7860/health

# Test server 2
curl http://localhost:7861/health

# Test load balancer
node test-dual-server.js
```

## 💰 Cost Management

### Monthly Costs (24/7 operation)
- **Server 1:** ~$87/month (existing rate)
- **Server 2:** ~$87/month (m:34326 at $0.121/hr)
- **Total:** ~$174/month

### Cost Optimization
- **Development:** Run only one server
- **Production:** Both servers for redundancy
- **Testing:** Start/stop servers as needed

## 🔍 Monitoring

### Health Checks
```bash
# Check both servers
curl http://localhost:7860/health
curl http://localhost:7861/health

# Check GPU usage
ssh -p 14688 root@ssh4.vast.ai "nvidia-smi"
ssh -p 12345 root@ssh5.vast.ai "nvidia-smi"
```

### Logs
```bash
# Server 1 logs
ssh -p 14688 root@ssh4.vast.ai "tail -f /root/sdxl-api.log"

# Server 2 logs
ssh -p 12345 root@ssh5.vast.ai "tail -f /root/sdxl-api.log"
```

## 🎯 Final Architecture

```
Your App (Next.js)
    │
    ├── Load Balancer
    │       │
    │       ├── Server 1 (RTX 3090 Ti)
    │       │   └── SDXL API :7860
    │       │
    │       └── Server 2 (RTX 3090)
    │           └── SDXL API :7860
    │
    └── Cloud Run
            └── Vosk Transcription
```

## ✅ Success Criteria

- [ ] Both servers running SDXL
- [ ] Both APIs responding to /health
- [ ] Load balancer distributing requests
- [ ] Fallback working if one server fails
- [ ] Images generating with crisp faces
- [ ] Cost within budget (~$174/month)

## 🔧 Troubleshooting

### SSH Connection Issues
```bash
# Test connection
ssh -p 12345 root@ssh5.vast.ai "echo 'Connected'"

# Check if instance is running
# Go to Vast.ai dashboard and verify status
```

### API Not Responding
```bash
# Check if API is running
ssh -p 12345 root@ssh5.vast.ai "ps aux | grep upgraded-sdxl-api"

# Restart API
ssh -p 12345 root@ssh5.vast.ai "pkill -f upgraded-sdxl-api.py && nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &"
```

### Load Balancer Issues
```bash
# Test each server individually
curl http://localhost:7860/health
curl http://localhost:7861/health

# Check environment variables
echo $VAST_AI_URL_PRIMARY
echo $VAST_AI_URL_SECONDARY
```

---

**Using the same SSH key simplifies management while maintaining security for your dual-server setup!**
