# Dual-Server Architecture Overview

## 🏗️ Your Current Architecture

You have **TWO separate AI services** running independently:

### **Server 1: Vast.ai - Image Generation** 🎨
- **Purpose:** Generate AI images (avatars, hero images)
- **Model:** Stable Diffusion 1.5 (upgrading to SDXL)
- **GPU:** RTX 3090 Ti (23.7GB VRAM)
- **Location:** Vast.ai cloud instance
- **Port:** 7860
- **Status:** ⚠️ Needs SDXL upgrade

### **Server 2: Google Cloud Run - Audio Transcription** 🎤
- **Purpose:** Transcribe audio posts to text
- **Model:** Vosk speech recognition
- **Resources:** 2 CPU, 2GB RAM
- **Location:** Google Cloud Run
- **Status:** ✅ Already deployed and working

---

## 📊 How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Carrot App                          │
│                  (Next.js on Render.com)                     │
└────────────────┬────────────────────────┬───────────────────┘
                 │                        │
                 │                        │
    ┌────────────▼──────────┐  ┌─────────▼──────────────┐
    │   Vast.ai Server      │  │  Google Cloud Run      │
    │   Image Generation    │  │  Transcription         │
    │                       │  │                        │
    │   • SD 1.5 → SDXL     │  │   • Vosk Service       │
    │   • Port 7860         │  │   • Auto-scaling       │
    │   • SSH Tunnel        │  │   • Always-on          │
    │   • RTX 3090 Ti       │  │   • 2 CPU / 2GB RAM    │
    └───────────────────────┘  └────────────────────────┘
         Image URLs                Transcription Text
```

---

## ✅ What's Already Done

### **Transcription Service (Server 2)**
- ✅ Deployed to Google Cloud Run
- ✅ Docker container built and running
- ✅ Vosk model loaded
- ✅ Integrated with your app
- ✅ Health endpoint working
- ✅ Auto-scales based on demand
- ✅ Min 1 instance (always on)
- ✅ Max 10 instances (handles bursts)

**Endpoint:** `https://vosk-transcription-XXXXXX-uc.a.run.app`

**How it works:**
1. User uploads audio post
2. App calls `/api/transcribe` endpoint
3. Endpoint proxies to Cloud Run service
4. Vosk transcribes audio
5. Transcription saved to Firestore
6. User sees transcription in UI

---

## ⚠️ What Needs to Be Done

### **Image Generation Service (Server 1)**
- ❌ SSH connection not verified
- ❌ SDXL upgrade not executed
- ❌ Models not downloaded
- ❌ Packages not installed
- ❌ API not updated

**Current state:** Running SD 1.5 (produces blurry faces)  
**Target state:** Running SDXL (crisp, photorealistic faces)

---

## 🔌 Connection Setup

### **Image Generation (Vast.ai)**

**Local Development (requires SSH tunnel):**
```bash
ssh -p 14688 root@ssh4.vast.ai -L 7860:localhost:7860
```

**Environment variable:**
```env
VAST_AI_URL=http://localhost:7860
```

**Your app calls:**
- `/api/img` → proxies to Vast.ai
- Generates images on demand
- Returns base64 image data

### **Transcription (Cloud Run)**

**Direct HTTPS access (no tunnel needed):**
```env
TRANSCRIPTION_SERVICE_URL=https://vosk-transcription-XXXXXX-uc.a.run.app
```

**Your app calls:**
- `/api/transcribe` → proxies to Cloud Run
- Transcribes audio files
- Returns text transcription

---

## 💰 Cost Comparison

| Service | Platform | Cost | Status |
|---------|----------|------|--------|
| **Image Gen** | Vast.ai | ~$0.20-0.50/hour | Pay per hour |
| **Transcription** | Cloud Run | ~$1-5/month | Pay per use |

**Note:** 
- Vast.ai charges **when running** (hourly)
- Cloud Run charges **per request** (very cheap)
- Cloud Run min-instances=1 keeps it always warm (~$10-15/month)

---

## 🔐 Security & Configuration

### **Environment Variables Needed**

**In `carrot/.env.local`:**
```env
# Image Generation (Vast.ai)
VAST_AI_URL=http://localhost:7860

# Transcription (Google Cloud Run)
TRANSCRIPTION_SERVICE_URL=https://vosk-transcription-XXXXXX-uc.a.run.app

# Firebase (for storing results)
FIREBASE_PROJECT_ID=involuted-river-466315-p0
```

### **Firewall & Access**

**Vast.ai:**
- No public access to port 7860
- Requires SSH tunnel for local dev
- Your app connects via tunnel

**Cloud Run:**
- Public HTTPS endpoint
- No authentication required (configured as `allow-unauthenticated`)
- Rate limiting handled by Cloud Run

---

## 🚀 Next Steps to Complete Setup

### **Step 1: Fix Vast.ai Connection**
```bash
# Verify instance is running
ssh -p 14688 root@ssh4.vast.ai

# Check disk space
df -h /
```

### **Step 2: Execute SDXL Upgrade**
```powershell
# Upload files
.\start-vast-sdxl-upgrade.ps1

# SSH in and run upgrade
ssh -p 14688 root@ssh4.vast.ai
./vast-cleanup-sdxl-upgrade.sh
./install-sdxl-packages.sh
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &
```

### **Step 3: Verify Both Services**
```bash
# Test transcription (should already work)
curl https://your-cloud-run-url.run.app/health

# Test image generation (after upgrade)
node test-upgraded-sdxl-api.js
```

### **Step 4: Update App Configuration**
Both services should be configured in your Next.js app's environment variables.

---

## 📈 Scaling Considerations

### **Image Generation (Vast.ai)**
- **Single instance** - handles requests sequentially
- **VRAM:** 23.7GB (can handle SDXL easily)
- **Generation time:** 30-60 seconds per image
- **Concurrent requests:** 1 at a time (limited by single GPU)

**If you need more capacity:**
- Rent 2nd Vast.ai instance
- Load balance between them
- Or upgrade to faster GPU

### **Transcription (Cloud Run)**
- **Auto-scales** from 1 to 10 instances
- **Concurrent requests:** Unlimited (Cloud Run handles)
- **Processing time:** ~30 seconds for 5-min audio
- **Cost:** Only pay for what you use

**Already optimized for scale!**

---

## 🔄 Load Balancing (Future Enhancement)

If you need multiple image generation servers:

```
                     ┌──────────────────┐
                     │   Load Balancer  │
                     │   (Round Robin)  │
                     └────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │  Vast.ai  │  │  Vast.ai  │  │  Vast.ai  │
        │  Server 1 │  │  Server 2 │  │  Server 3 │
        │  :7860    │  │  :7861    │  │  :7862    │
        └───────────┘  └───────────┘  └───────────┘
```

**Implementation:**
1. Rent multiple Vast.ai instances
2. Create load balancer in your Next.js API
3. Distribute requests across instances
4. Each instance generates 1 image at a time

**Code example:**
```typescript
// In your API route
const vastServers = [
  'http://localhost:7860',
  'http://localhost:7861', 
  'http://localhost:7862'
];

let currentServer = 0;
function getNextServer() {
  const server = vastServers[currentServer];
  currentServer = (currentServer + 1) % vastServers.length;
  return server;
}
```

---

## 🎯 Summary

### **What You Have:**
- ✅ 2-server architecture (image + transcription)
- ✅ Transcription service fully operational
- ⚠️ Image generation needs SDXL upgrade

### **What You Need to Do:**
1. **Fix SSH connection** to Vast.ai
2. **Execute SDXL upgrade** (~40 minutes)
3. **Test both services** working together
4. **Verify your app** can use both

### **Result:**
- 🎨 High-quality SDXL images (sharp faces)
- 🎤 Accurate audio transcriptions
- 📱 Fully featured social app
- 💰 Cost-effective architecture

---

## 📝 Quick Reference

**Check Transcription Service:**
```bash
curl https://vosk-transcription-XXXXXX-uc.a.run.app/health
```

**Check Image Generation Service:**
```bash
# After SSH tunnel is active
curl http://localhost:7860/health
```

**Deploy Transcription Update:**
```bash
cd carrot/transcription-service
./deploy.sh
```

**Update Image Generation:**
```bash
# Upload new API file
scp -P 14688 upgraded-sdxl-api.py root@ssh4.vast.ai:/root/

# SSH in and restart
ssh -p 14688 root@ssh4.vast.ai
pkill -f upgraded-sdxl-api.py
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &
```

---

**Both servers are independent and can be updated/scaled separately!**
