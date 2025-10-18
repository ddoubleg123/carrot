# Production Setup Guide - AI Image Generation

## 🚀 **Quick Setup for Production**

Your AI image generation code is deployed, but you need to configure a public SDXL endpoint for production. Here are your options:

---

## Option 1: Replicate API (Recommended) ⭐

**Pros**: Easy, reliable, pay-per-use, no infrastructure  
**Cons**: ~$0.01 per image  
**Setup Time**: 5 minutes

### **Steps**

1. **Sign up for Replicate**
   - Go to https://replicate.com
   - Create account and get API token

2. **Add Environment Variable on Render.com**
   ```bash
   REPLICATE_API_TOKEN=r8_your_token_here
   ```

3. **Update Code** (Quick 2-minute change)
   
   Modify `carrot/src/app/api/ai/generate-hero-image/route.ts`:
   
   ```typescript
   // Add at top
   import Replicate from 'replicate';
   
   // Replace SDXL API call with:
   const replicate = new Replicate({
     auth: process.env.REPLICATE_API_TOKEN,
   });
   
   const output = await replicate.run(
     "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
     {
       input: {
         prompt: positivePrompt,
         negative_prompt: negativePrompt,
         width: 1024,
         height: 1024,
         num_inference_steps: 20,
         guidance_scale: 7.5
       }
     }
   );
   
   const imageUrl = output[0]; // Replicate returns array
   ```

4. **Test**
   ```bash
   # Deploy changes
   git add .
   git commit -m "feat: Add Replicate API for production"
   git push
   
   # Wait for Render deployment (~2 mins)
   # Test on production site
   ```

---

## Option 2: Cloudflare Tunnel (Free)

**Pros**: Free, uses your Vast.ai GPU  
**Cons**: Requires maintenance, tunnel stability  
**Setup Time**: 15 minutes

### **Steps**

1. **Install Cloudflare Tunnel on Vast.ai**
   ```bash
   # SSH into Vast.ai
   ssh -p 30400 root@111.59.36.106
   
   # Install cloudflared
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   chmod +x cloudflared-linux-amd64
   mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
   
   # Login to Cloudflare
   cloudflared tunnel login
   ```

2. **Create Tunnel**
   ```bash
   # Create tunnel
   cloudflared tunnel create sdxl-api
   
   # Configure tunnel
   cat > ~/.cloudflared/config.yml << EOF
   tunnel: sdxl-api
   credentials-file: /root/.cloudflared/<tunnel-id>.json
   
   ingress:
     - hostname: sdxl.yourdomain.com
       service: http://localhost:7860
     - service: http_status:404
   EOF
   
   # Run tunnel
   cloudflared tunnel run sdxl-api
   ```

3. **Update Environment Variable**
   ```bash
   # On Render.com
   VAST_AI_URL=https://sdxl.yourdomain.com
   ```

4. **Keep Tunnel Running**
   ```bash
   # Install as systemd service
   sudo cloudflared service install
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared
   ```

---

## Option 3: ngrok (Quick Test)

**Pros**: Fastest setup for testing  
**Cons**: Free tier has limits, URL changes  
**Setup Time**: 2 minutes

### **Steps**

1. **Install ngrok on Vast.ai**
   ```bash
   ssh -p 30400 root@111.59.36.106
   
   # Download ngrok
   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
   tar xvzf ngrok-v3-stable-linux-amd64.tgz
   mv ngrok /usr/local/bin/
   
   # Start tunnel
   ngrok http 7860
   ```

2. **Copy URL and Update Environment**
   ```bash
   # ngrok will show: Forwarding https://abc123.ngrok.io -> localhost:7860
   # On Render.com:
   VAST_AI_URL=https://abc123.ngrok.io
   ```

3. **Note**: URL changes each restart on free tier

---

## Option 4: Deploy SDXL on Render (Expensive)

**Pros**: Fully managed, reliable  
**Cons**: $200+/month for GPU instance  
**Setup Time**: 30 minutes

### **Steps**

1. **Create New Render Service**
   - Type: Web Service
   - Runtime: Docker
   - Instance: GPU (High Memory)

2. **Add Dockerfile**
   ```dockerfile
   FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04
   
   WORKDIR /app
   COPY upgraded-sdxl-api.py .
   COPY requirements.txt .
   
   RUN pip install -r requirements.txt
   
   CMD ["python", "upgraded-sdxl-api.py"]
   ```

3. **Deploy and Configure**
   ```bash
   VAST_AI_URL=https://sdxl-api.onrender.com
   ```

---

## 🎯 **Recommended Setup by Use Case**

### **For Development/Testing**
- **Option 3**: ngrok (quick and easy)
- No cost, perfect for testing

### **For Production (Low Volume)**
- **Option 1**: Replicate API
- Pay only for what you use
- Most reliable

### **For Production (High Volume)**
- **Option 2**: Cloudflare Tunnel
- Free, but requires maintenance
- Best cost/performance ratio

### **For Enterprise**
- **Option 4**: Self-hosted on Render
- Full control, predictable costs
- Best performance

---

## 📊 **Cost Comparison**

| Option | Setup | Monthly Cost | Per Image | Reliability |
|--------|-------|--------------|-----------|-------------|
| Replicate | 5 min | $0 + usage | ~$0.01 | ⭐⭐⭐⭐⭐ |
| Cloudflare | 15 min | $0 | $0 | ⭐⭐⭐⭐ |
| ngrok | 2 min | $0-25 | $0 | ⭐⭐⭐ |
| Render GPU | 30 min | $200+ | $0 | ⭐⭐⭐⭐⭐ |
| Vast.ai (current) | 0 min | ~$20 | $0 | ⭐⭐⭐ |

---

## ✅ **Verification**

After setup, test your endpoint:

### **Health Check**
```bash
curl https://your-endpoint.com/health
# Should return: {"status":"healthy","model":"sdxl"}
```

### **Test Generation**
```bash
curl -X POST https://your-endpoint.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "negative_prompt": "blurry, low quality",
    "num_inference_steps": 20,
    "width": 1024,
    "height": 1024
  }'
```

### **Test on Production**
```bash
# Trigger discovery on any patch
https://carrot-app.onrender.com/patch/chicago-bulls

# Click "Start Discovery"
# Check logs for: "✅ AI image generated successfully"
```

---

## 🚨 **Troubleshooting**

### **Images Not Generating**
1. Check environment variable is set: `echo $VAST_AI_URL`
2. Verify endpoint is accessible: `curl $VAST_AI_URL/health`
3. Check Render logs for errors
4. Test fallback: Discovery should still work

### **Slow Generation**
- Replicate: Normal (10-15 seconds)
- Cloudflare: Check tunnel stability
- Render: May need larger instance

### **High Costs**
- Switch from Render GPU to Replicate
- Or use Cloudflare tunnel with Vast.ai
- Enable caching to reduce duplicates

---

## 📞 **Need Help?**

1. **Check logs**: Render.com → Your Service → Logs
2. **Test endpoint**: Use curl commands above
3. **Verify fallback**: Discovery should work even if AI fails
4. **Review docs**: `docs/handoffs/2025-10-18-AI-IMAGE-INTEGRATION.md`

---

## 🎉 **Quick Start (5 Minutes)**

**For fastest production setup:**

```bash
# 1. Sign up for Replicate.com
# 2. Get API token
# 3. Add to Render.com environment:
REPLICATE_API_TOKEN=r8_your_token

# 4. Update code (see Option 1)
# 5. Deploy
git add .
git commit -m "Add Replicate API"
git push

# 6. Test!
```

**Done! Your production AI image generation is live!** 🚀

---

*Last Updated: October 18, 2025*

