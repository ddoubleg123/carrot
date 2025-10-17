#!/bin/bash
# Deploy upgraded SDXL API to Vast.ai
# This script uploads the API file and starts the service

echo "=========================================="
echo "DEPLOY SDXL API TO VAST.AI"
echo "=========================================="
echo ""

# Configuration
VAST_HOST="ssh4.vast.ai"
VAST_PORT="14688"
VAST_USER="root"
API_FILE="upgraded-sdxl-api.py"
REMOTE_DIR="/root"

echo "🔧 Configuration:"
echo "  Host: $VAST_HOST"
echo "  Port: $VAST_PORT"
echo "  API File: $API_FILE"
echo ""

# Check if API file exists
if [ ! -f "$API_FILE" ]; then
    echo "❌ Error: $API_FILE not found!"
    exit 1
fi

echo "📤 Uploading API file to Vast.ai..."
scp -P $VAST_PORT "$API_FILE" "$VAST_USER@$VAST_HOST:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
    echo "❌ Upload failed!"
    exit 1
fi

echo "✅ Upload successful!"
echo ""

echo "🚀 Starting SDXL API service..."
echo "Connecting to Vast.ai and starting the server..."
echo ""

# SSH into Vast.ai and start the service
ssh -p $VAST_PORT "$VAST_USER@$VAST_HOST" << 'ENDSSH'
    cd /root
    
    # Kill any existing Python processes running the API
    pkill -f "upgraded-sdxl-api.py" 2>/dev/null
    pkill -f "working-sd-api.py" 2>/dev/null
    
    echo "Starting upgraded SDXL API..."
    
    # Start the API in the background
    nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &
    
    echo "API starting... Process ID: $!"
    echo ""
    echo "To monitor logs:"
    echo "  tail -f /root/sdxl-api.log"
    echo ""
    echo "To check if running:"
    echo "  curl http://localhost:7860/health"
    echo ""
    
    # Wait a few seconds and check if process is running
    sleep 5
    
    if pgrep -f "upgraded-sdxl-api.py" > /dev/null; then
        echo "✅ API process is running!"
        echo ""
        echo "📊 Initial logs:"
        tail -20 /root/sdxl-api.log
    else
        echo "❌ API process failed to start. Check logs:"
        cat /root/sdxl-api.log
        exit 1
    fi
ENDSSH

echo ""
echo "=========================================="
echo "✅ Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for models to load"
echo "2. Test the API: node test-upgraded-sdxl-api.js"
echo "3. Check logs on Vast.ai: ssh -p $VAST_PORT $VAST_USER@$VAST_HOST 'tail -f /root/sdxl-api.log'"
echo ""

