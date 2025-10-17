#!/bin/bash
# Start Stable Diffusion WebUI in the background

echo "🚀 Starting Stable Diffusion WebUI API..."

cd /root/stable-diffusion-webui || exit 1

# Kill any existing processes
pkill -f "webui.sh" || true
pkill -f "launch.py" || true
sleep 2

# Start in background with nohup
echo "Starting WebUI in background..."
nohup bash webui-user.sh > /root/sd-webui.log 2>&1 &

# Get the PID
SD_PID=$!
echo "Stable Diffusion WebUI started with PID: $SD_PID"
echo $SD_PID > /root/sd-webui.pid

echo ""
echo "✅ Service starting..."
echo "📝 Logs: tail -f /root/sd-webui.log"
echo "🔍 Check process: ps aux | grep webui"
echo "🌐 API will be available at: http://83.10.113.244:7860"
echo ""
echo "⏳ Wait 2-3 minutes for the service to fully initialize..."

