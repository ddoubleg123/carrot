#!/bin/bash
# SDXL Deployment Script - Automated upgrade from SD v1.5 to SDXL
# Usage: ./deploy-sdxl.sh
# Run this script ON the Vast.ai instance

set -e  # Exit on error

echo "================================================================"
echo "🚀 SDXL Deployment Script"
echo "================================================================"
echo ""
echo "This script will:"
echo "  1. Backup current SD v1.5 setup"
echo "  2. Verify system requirements"
echo "  3. Stop SD v1.5 service"
echo "  4. Start SDXL service"
echo "  5. Monitor startup and model download"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "================================================================"
echo "📋 Phase 1: Pre-Deployment Checks"
echo "================================================================"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (you're on Vast.ai, should be root)"
   exit 1
fi

# Check disk space (need at least 20GB free)
echo "🔍 Checking disk space..."
AVAILABLE_GB=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
echo "   Available: ${AVAILABLE_GB}GB"

if [[ $AVAILABLE_GB -lt 20 ]]; then
    echo "⚠️  Warning: Less than 20GB free space (${AVAILABLE_GB}GB available)"
    echo "   SDXL models need ~15GB. Continue anyway?"
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled. Free up disk space first."
        exit 1
    fi
else
    echo "   ✅ Sufficient disk space"
fi

# Check GPU
echo ""
echo "🎮 Checking GPU..."
if command -v nvidia-smi &> /dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -1)
    echo "   GPU: $GPU_NAME"
    echo "   VRAM: $GPU_MEMORY"
    echo "   ✅ GPU detected"
else
    echo "   ❌ nvidia-smi not found. CUDA may not be available."
    exit 1
fi

# Check Python and dependencies
echo ""
echo "🐍 Checking Python environment..."
if ! command -v python3 &> /dev/null; then
    echo "   ❌ python3 not found"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "   Python: $PYTHON_VERSION"

# Check critical packages
echo "   Checking dependencies..."
MISSING_DEPS=()

for package in torch diffusers transformers accelerate fastapi uvicorn; do
    if ! python3 -c "import $package" 2>/dev/null; then
        MISSING_DEPS+=($package)
    fi
done

if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
    echo "   ⚠️  Missing packages: ${MISSING_DEPS[*]}"
    echo "   Installing missing dependencies..."
    pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121
    pip install diffusers==0.35.1 transformers==4.57.0 accelerate==1.10.1 safetensors==0.6.2
    pip install fastapi==0.119.0 uvicorn==0.37.0 pillow
    echo "   ✅ Dependencies installed"
else
    echo "   ✅ All dependencies present"
fi

# Check if upgraded-sdxl-api.py exists
echo ""
echo "📄 Checking for SDXL API script..."
if [[ ! -f /root/upgraded-sdxl-api.py ]]; then
    echo "   ❌ /root/upgraded-sdxl-api.py not found"
    echo "   Please upload upgraded-sdxl-api.py to /root/ first"
    echo "   From local machine run:"
    echo "   scp -P 45583 upgraded-sdxl-api.py root@171.247.185.4:/root/"
    exit 1
else
    echo "   ✅ SDXL API script found"
fi

echo ""
echo "================================================================"
echo "💾 Phase 2: Backup Current Setup"
echo "================================================================"
echo ""

# Create backup directory with timestamp
BACKUP_DIR="/root/backups/sd-v15-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📁 Backup directory: $BACKUP_DIR"

# Check if SD v1.5 API is running
echo ""
echo "🔍 Checking current service..."
if pgrep -f "working-sd-api.py" > /dev/null; then
    echo "   ✅ SD v1.5 service is running"
    
    # Test current API
    echo "   Testing current API..."
    if curl -s http://localhost:7860/health > /dev/null; then
        echo "   ✅ Current API responding"
        curl -s http://localhost:7860/health | python3 -m json.tool > "$BACKUP_DIR/health-before.json"
    else
        echo "   ⚠️  Current API not responding on port 7860"
    fi
    
    # Save process info
    ps aux | grep "working-sd-api.py" | grep -v grep > "$BACKUP_DIR/process-before.txt"
    
    # Backup script
    if [[ -f /root/working-sd-api.py ]]; then
        cp /root/working-sd-api.py "$BACKUP_DIR/"
        echo "   ✅ Backed up working-sd-api.py"
    fi
    
    # Backup logs
    if [[ -f /tmp/sd-api.log ]]; then
        cp /tmp/sd-api.log "$BACKUP_DIR/sd-api-before.log
    fi
    
else
    echo "   ⚠️  SD v1.5 service not running (this is ok)"
fi

echo "   ✅ Backup complete: $BACKUP_DIR"

echo ""
echo "================================================================"
echo "🛑 Phase 3: Stop Current Service"
echo "================================================================"
echo ""

# Stop any running SD services
echo "Stopping current services..."
pkill -f "working-sd-api.py" || true
pkill -f "upgraded-sdxl-api.py" || true
sleep 2

# Verify stopped
if pgrep -f "sd-api.py" > /dev/null; then
    echo "⚠️  Service still running, force killing..."
    pkill -9 -f "sd-api.py" || true
    sleep 2
fi

if pgrep -f "sd-api.py" > /dev/null; then
    echo "❌ Failed to stop existing service"
    exit 1
else
    echo "✅ All SD services stopped"
fi

echo ""
echo "================================================================"
echo "🚀 Phase 4: Start SDXL Service"
echo "================================================================"
echo ""

echo "Starting SDXL API on port 7860..."
nohup python3 /root/upgraded-sdxl-api.py > /tmp/sdxl-api.log 2>&1 &
SDXL_PID=$!
echo $SDXL_PID > /root/sdxl-api.pid

echo "✅ SDXL service started (PID: $SDXL_PID)"
echo ""

# Wait a moment for startup
echo "⏳ Waiting for service to initialize..."
sleep 5

# Check if process is still running
if ! ps -p $SDXL_PID > /dev/null; then
    echo "❌ SDXL service crashed immediately!"
    echo ""
    echo "📋 Last 20 lines of log:"
    tail -20 /tmp/sdxl-api.log
    exit 1
fi

echo "✅ Process is running"

echo ""
echo "================================================================"
echo "📥 Phase 5: Monitor Model Download"
echo "================================================================"
echo ""
echo "ℹ️  SDXL models will download automatically (~15GB, 20-30 min)"
echo "   This is a one-time download. Models are cached for future use."
echo ""
echo "📋 Live log monitoring (Ctrl+C to stop watching, service continues):"
echo "----------------------------------------------------------------"
echo ""

# Monitor logs for model loading
tail -f /tmp/sdxl-api.log &
TAIL_PID=$!

# Wait for model loading to complete (check every 10 seconds)
MAX_WAIT=1800  # 30 minutes max
WAITED=0

while [[ $WAITED -lt $MAX_WAIT ]]; do
    sleep 10
    WAITED=$((WAITED + 10))
    
    # Check if model loaded successfully
    if grep -q "SDXL Refiner model loaded successfully" /tmp/sdxl-api.log; then
        kill $TAIL_PID 2>/dev/null || true
        echo ""
        echo "================================================================"
        echo "✅ Models loaded successfully!"
        echo "================================================================"
        break
    fi
    
    # Check for errors
    if grep -q "Failed to load models" /tmp/sdxl-api.log; then
        kill $TAIL_PID 2>/dev/null || true
        echo ""
        echo "================================================================"
        echo "❌ Model loading failed!"
        echo "================================================================"
        echo ""
        echo "📋 Error log:"
        grep -A 10 "Failed to load models" /tmp/sdxl-api.log
        exit 1
    fi
    
    # Check if process died
    if ! ps -p $SDXL_PID > /dev/null; then
        kill $TAIL_PID 2>/dev/null || true
        echo ""
        echo "❌ SDXL service crashed during startup!"
        echo ""
        echo "📋 Full log:"
        cat /tmp/sdxl-api.log
        exit 1
    fi
done

# If we timed out
if [[ $WAITED -ge $MAX_WAIT ]]; then
    kill $TAIL_PID 2>/dev/null || true
    echo ""
    echo "⚠️  Timeout waiting for models to load (waited ${WAITED}s)"
    echo "   The service may still be downloading models."
    echo "   Check logs with: tail -f /tmp/sdxl-api.log"
    echo ""
    read -p "Continue with verification anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "================================================================"
echo "✅ Phase 6: Deployment Complete!"
echo "================================================================"
echo ""
echo "📊 Service Status:"
echo "   PID: $SDXL_PID"
echo "   Port: 7860"
echo "   Log: /tmp/sdxl-api.log"
echo ""
echo "🔧 Next Steps:"
echo "   1. Run verification: ./verify-sdxl.sh"
echo "   2. Test from local machine via SSH tunnel"
echo "   3. Generate test image from application"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:    tail -f /tmp/sdxl-api.log"
echo "   Health check: curl http://localhost:7860/health"
echo "   Stop service: pkill -f upgraded-sdxl-api.py"
echo "   Rollback:     ./rollback-sdxl.sh"
echo ""
echo "================================================================"

