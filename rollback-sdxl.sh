#!/bin/bash
# SDXL Rollback Script - Revert to SD v1.5
# Usage: ./rollback-sdxl.sh
# Run this script ON the Vast.ai instance if SDXL has issues

set -e

echo "================================================================"
echo "⏮️  SDXL Rollback Script"
echo "================================================================"
echo ""
echo "This script will:"
echo "  1. Stop SDXL service"
echo "  2. Restore SD v1.5 service"
echo "  3. Verify SD v1.5 is working"
echo ""
echo "⚠️  This will revert to Stable Diffusion v1.5"
echo ""
read -p "Continue with rollback? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled"
    exit 1
fi

echo ""
echo "================================================================"
echo "🛑 Step 1: Stop SDXL Service"
echo "================================================================"
echo ""

if pgrep -f "upgraded-sdxl-api.py" > /dev/null; then
    echo "Stopping SDXL service..."
    pkill -f "upgraded-sdxl-api.py" || true
    sleep 2
    
    if pgrep -f "upgraded-sdxl-api.py" > /dev/null; then
        echo "Force killing SDXL service..."
        pkill -9 -f "upgraded-sdxl-api.py" || true
        sleep 1
    fi
    
    if pgrep -f "upgraded-sdxl-api.py" > /dev/null; then
        echo "❌ Failed to stop SDXL service"
        exit 1
    else
        echo "✅ SDXL service stopped"
    fi
else
    echo "ℹ️  SDXL service not running"
fi

echo ""
echo "================================================================"
echo "📋 Step 2: Verify SD v1.5 Script Exists"
echo "================================================================"
echo ""

if [[ ! -f /root/working-sd-api.py ]]; then
    echo "⚠️  /root/working-sd-api.py not found"
    echo ""
    
    # Check backups
    LATEST_BACKUP=$(ls -td /root/backups/sd-v15-* 2>/dev/null | head -1)
    
    if [[ -n $LATEST_BACKUP ]] && [[ -f "$LATEST_BACKUP/working-sd-api.py" ]]; then
        echo "📦 Found backup: $LATEST_BACKUP"
        echo "   Restoring working-sd-api.py from backup..."
        cp "$LATEST_BACKUP/working-sd-api.py" /root/
        echo "   ✅ Restored from backup"
    else
        echo "❌ No backup found. Cannot rollback automatically."
        echo ""
        echo "Manual recovery options:"
        echo "  1. Re-upload working-sd-api.py from local machine"
        echo "     scp -P 45583 working-sd-api.py root@171.247.185.4:/root/"
        echo "  2. Re-create from STABLE-DIFFUSION-SETUP.md"
        echo ""
        exit 1
    fi
else
    echo "✅ SD v1.5 script found"
fi

echo ""
echo "================================================================"
echo "🚀 Step 3: Start SD v1.5 Service"
echo "================================================================"
echo ""

echo "Starting SD v1.5 API on port 7860..."
nohup python3 /root/working-sd-api.py > /tmp/sd-api.log 2>&1 &
SD_PID=$!
echo $SD_PID > /root/sd-api.pid

echo "✅ SD v1.5 service started (PID: $SD_PID)"
echo ""

# Wait for startup
echo "⏳ Waiting for service to initialize (10 seconds)..."
sleep 10

# Check if process is still running
if ! ps -p $SD_PID > /dev/null; then
    echo "❌ SD v1.5 service crashed on startup!"
    echo ""
    echo "📋 Log output:"
    tail -30 /tmp/sd-api.log
    exit 1
fi

echo "✅ Process is running"

echo ""
echo "================================================================"
echo "🔍 Step 4: Verify SD v1.5 Service"
echo "================================================================"
echo ""

# Wait a bit more for model loading
echo "⏳ Waiting for model to load (30 seconds)..."
sleep 30

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:7860/health 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [[ $HTTP_CODE == "200" ]]; then
    echo "✅ Health endpoint responding"
    echo ""
    echo "📋 Health status:"
    echo "$HEALTH_BODY" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_BODY"
    echo ""
    
    # Check model loaded
    MODEL_LOADED=$(echo "$HEALTH_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('model_loaded', False))" 2>/dev/null)
    
    if [[ $MODEL_LOADED == "True" ]]; then
        echo "✅ Model loaded successfully"
    else
        echo "⚠️  Model not loaded yet, may still be loading..."
        echo "   Check logs: tail -f /tmp/sd-api.log"
    fi
else
    echo "❌ Health endpoint not responding (HTTP $HTTP_CODE)"
    echo ""
    echo "📋 Recent logs:"
    tail -20 /tmp/sd-api.log
    exit 1
fi

# Quick generation test
echo ""
echo "🔍 Testing image generation..."
TEST_START=$(date +%s)

GEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:7860/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a red apple",
    "num_inference_steps": 15
  }' 2>/dev/null || echo -e "\n000")

TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))

GEN_HTTP_CODE=$(echo "$GEN_RESPONSE" | tail -1)

if [[ $GEN_HTTP_CODE == "200" ]]; then
    echo "✅ Image generation working (${TEST_DURATION}s)"
else
    echo "⚠️  Image generation failed (HTTP $GEN_HTTP_CODE)"
    echo "   This may be normal if model is still loading"
fi

echo ""
echo "================================================================"
echo "✅ Rollback Complete!"
echo "================================================================"
echo ""
echo "📊 Status:"
echo "   Service: SD v1.5"
echo "   PID: $SD_PID"
echo "   Port: 7860"
echo "   Log: /tmp/sd-api.log"
echo ""
echo "📝 What was rolled back:"
echo "   ❌ SDXL Base + Refiner (stopped)"
echo "   ✅ Stable Diffusion v1.5 (restored)"
echo ""
echo "🔧 Next Steps:"
echo "   1. Verify service works from local machine"
echo "   2. Test from application"
echo "   3. Review logs if needed: tail -f /tmp/sd-api.log"
echo ""
echo "💡 To retry SDXL deployment:"
echo "   1. Review what went wrong"
echo "   2. Fix any issues (disk space, dependencies, etc.)"
echo "   3. Run: ./deploy-sdxl.sh"
echo ""
echo "================================================================"

# Show current backups
if ls /root/backups/sd-v15-* 1> /dev/null 2>&1; then
    echo ""
    echo "📦 Available backups:"
    ls -lt /root/backups/sd-v15-*/
    echo ""
fi

echo "================================================================"

