# Manual Deployment Steps for Second Server

## 🚨 The Issue
The automated scripts keep hanging on SSH commands. Let's do this manually.

## 📋 Manual Steps

### Step 1: Upload Files Manually

Open a **new terminal/command prompt** and run these commands one by one:

```bash
# Upload cleanup script
scp -P 30400 vast-cleanup-sdxl-upgrade.sh root@111.59.36.106:/root/

# Upload installation script  
scp -P 30400 install-sdxl-packages.sh root@111.59.36.106:/root/

# Upload API file
scp -P 30400 upgraded-sdxl-api.py root@111.59.36.106:/root/

# Upload test script
scp -P 30400 test-upgraded-sdxl-api.js root@111.59.36.106:/root/
```

### Step 2: SSH into Second Server

```bash
ssh -p 30400 root@111.59.36.106
```

### Step 3: Run Upgrade Commands (on the server)

Once you're SSH'd in, run these commands:

```bash
# Make scripts executable
chmod +x vast-cleanup-sdxl-upgrade.sh
chmod +x install-sdxl-packages.sh

# Step 1: Cleanup (5 minutes)
./vast-cleanup-sdxl-upgrade.sh

# Step 2: Install packages (15 minutes)
./install-sdxl-packages.sh

# Step 3: Start API
pkill -f upgraded-sdxl-api.py 2>/dev/null
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &

# Check if it's running
ps aux | grep upgraded-sdxl-api

# Monitor logs
tail -f sdxl-api.log
```

### Step 4: Test the Server

From your **local machine** (new terminal):

```bash
# Create SSH tunnel for second server
ssh -p 30400 root@111.59.36.106 -L 7861:localhost:7860

# In another terminal, test the server
curl http://localhost:7861/health
```

## 🔧 Alternative: Use Proxy Connection

If direct connection fails, try the proxy:

```bash
# Upload via proxy
scp -P 28963 vast-cleanup-sdxl-upgrade.sh root@ssh1.vast.ai:/root/
scp -P 28963 install-sdxl-packages.sh root@ssh1.vast.ai:/root/
scp -P 28963 upgraded-sdxl-api.py root@ssh1.vast.ai:/root/

# SSH via proxy
ssh -p 28963 root@ssh1.vast.ai
```

## 🎯 Expected Results

After 30-40 minutes, you should have:
- ✅ Second server running SDXL API on port 7860
- ✅ SSH tunnel from localhost:7861 → server:7860
- ✅ Health endpoint responding
- ✅ Ready for dual-server setup

## 🚨 If Commands Hang

If any command hangs:
1. **Press Ctrl+C** to cancel
2. **Try the proxy connection** instead
3. **Check Vast.ai dashboard** - make sure instance is running
4. **Try different terminal** (PowerShell vs Command Prompt)

## 📞 Next Steps After Success

1. **Test both servers:**
   ```bash
   curl http://localhost:7860/health  # Server 1
   curl http://localhost:7861/health  # Server 2
   ```

2. **Start dual tunnels:**
   ```powershell
   .\start-dual-tunnels.ps1
   ```

3. **Implement load balancing** in your app

---

**The automated approach is failing, but manual deployment should work fine!**
