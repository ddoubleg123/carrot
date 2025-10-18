# Expose Vast.ai SDXL API Publicly

## 🎯 **Goal: Make Your Vast.ai SDXL API Accessible from Render.com**

Current problem:
```
Render.com → http://localhost:7860 ❌ Can't reach!
```

Solution needed:
```
Render.com → http://PUBLIC_URL:7860 ✅ Works!
```

---

## Option 1: Use Vast.ai Public Port (Fastest - 2 minutes)

Vast.ai instances often have public ports exposed. Let's check:

### **Step 1: Find Your Public Port**
```bash
# SSH into your Vast.ai instance
ssh -p 30400 root@111.59.36.106

# Check what ports are exposed
curl ifconfig.me  # Get your public IP
netstat -tlnp | grep 7860  # Check if 7860 is listening publicly
```

### **Step 2: Test Public Access**
```bash
# From your local machine (NOT in SSH):
curl http://111.59.36.106:7860/health

# If it works, you're done! Use this:
VAST_AI_URL=http://111.59.36.106:7860
```

---

## Option 2: Cloudflare Tunnel (Free, Permanent - 15 minutes)

### **Step 1: Install on Vast.ai**
```bash
# SSH into Vast.ai
ssh -p 30400 root@111.59.36.106

# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Login (opens browser for auth)
cloudflared tunnel login
```

### **Step 2: Create Tunnel**
```bash
# Create tunnel
cloudflared tunnel create sdxl-api

# You'll get output like:
# Created tunnel sdxl-api with id: abc123-def456-...
# Credentials written to: /root/.cloudflared/abc123.json

# Configure tunnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: sdxl-api
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: sdxl-YOUR_SUBDOMAIN.trycloudflare.com
    service: http://localhost:7860
  - service: http_status:404
EOF
```

### **Step 3: Run Tunnel**
```bash
# Start tunnel (in background)
nohup cloudflared tunnel run sdxl-api > /tmp/tunnel.log 2>&1 &

# Check it's running
curl https://sdxl-YOUR_SUBDOMAIN.trycloudflare.com/health
```

### **Step 4: Update Environment Variable**
```bash
# On Render.com:
VAST_AI_URL=https://sdxl-YOUR_SUBDOMAIN.trycloudflare.com
```

---

## Option 3: ngrok (Quick Test - 5 minutes)

### **Step 1: Install on Vast.ai**
```bash
# SSH into Vast.ai
ssh -p 30400 root@111.59.36.106

# Download and install ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
mv ngrok /usr/local/bin/

# Sign up at ngrok.com and get auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### **Step 2: Start Tunnel**
```bash
# Start ngrok tunnel
nohup ngrok http 7860 > /tmp/ngrok.log 2>&1 &

# Get the public URL
curl http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app'

# Example output:
# https://abc-123-def.ngrok-free.app
```

### **Step 3: Test and Configure**
```bash
# Test from anywhere:
curl https://YOUR_NGROK_URL.ngrok-free.app/health

# On Render.com:
VAST_AI_URL=https://YOUR_NGROK_URL.ngrok-free.app
```

**Note**: Free ngrok URLs change on restart!

---

## Option 4: Vast.ai Direct Access (If Available)

Some Vast.ai instances expose ports directly. Check Vast.ai dashboard:

1. Go to https://vast.ai/console/instances
2. Find your instance
3. Look for "Public IP" or "Direct Connect" info
4. Check if port 7860 is exposed

If yes:
```bash
VAST_AI_URL=http://VAST_PUBLIC_IP:7860
```

---

## 🚀 **Recommended: Cloudflare Tunnel**

**Why:**
- ✅ Free forever
- ✅ Persistent URL (doesn't change)
- ✅ HTTPS (secure)
- ✅ Reliable
- ✅ No auth token limits

**vs ngrok:**
- ngrok free tier: URL changes on restart
- ngrok paid: $10/month minimum

---

## 📋 **Quick Start Commands**

### **For Cloudflare Tunnel:**
```bash
# 1. SSH to Vast.ai
ssh -p 30400 root@111.59.36.106

# 2. One-liner install
wget -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x cloudflared && mv cloudflared /usr/local/bin/

# 3. Setup (follow prompts)
cloudflared tunnel login
cloudflared tunnel create sdxl-api
cloudflared tunnel route dns sdxl-api sdxl.yourdomain.com  # Or use trycloudflare.com

# 4. Run
cloudflared tunnel --url http://localhost:7860

# You'll get a URL like:
# https://sdxl-abc123.trycloudflare.com
```

### **For ngrok:**
```bash
# 1. SSH to Vast.ai
ssh -p 30400 root@111.59.36.106

# 2. One-liner install
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz && tar xvzf ngrok-v3-stable-linux-amd64.tgz && mv ngrok /usr/local/bin/

# 3. Run (no auth needed for testing)
ngrok http 7860

# You'll get a URL like:
# https://abc-123.ngrok-free.app
```

---

## ✅ **After Getting Public URL**

1. **Set Environment Variable on Render.com:**
   ```bash
   VAST_AI_URL=https://your-public-url.com
   ```

2. **Restart Render Service**

3. **Test:**
   ```bash
   # Should return real AI images now!
   curl https://carrot-app.onrender.com/api/ai/generate-hero-image \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","summary":"Test"}'
   ```

4. **Verify in Database:**
   ```javascript
   heroImageSource: 'ai-generated'  // ✅ Should be this now!
   ```

---

## 🎯 **Which Option?**

**I recommend: Cloudflare Tunnel**
- Permanent URL
- Free
- Reliable
- 15 minutes setup

**Want me to walk you through setting up Cloudflare Tunnel on your Vast.ai instance?**

---

*Document Created: October 18, 2025*  
*Purpose: Expose Vast.ai SDXL API for production use*

