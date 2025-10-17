#!/bin/bash
# Start Stable Diffusion WebUI as sduser

echo "🚀 Starting Stable Diffusion WebUI API as sduser..."

# Kill any existing processes
pkill -f "webui.sh" || true
pkill -f "launch.py" || true
sleep 2

# Change ownership of the directory to sduser if needed
chown -R sduser:sduser /root/stable-diffusion-webui

# Start as sduser in background
su - sduser -c "cd /root/stable-diffusion-webui && nohup bash webui-user.sh > /root/sd-webui.log 2>&1 &"

sleep 3

# Get the PID
SD_PID=$(pgrep -f "launch.py")
if [ -n "$SD_PID" ]; then
  echo "✅ Stable Diffusion WebUI started with PID: $SD_PID"
  echo $SD_PID > /root/sd-webui.pid
else
  echo "⚠️  Could not find process, check logs..."
fi

echo ""
echo "📝 View logs: tail -f /root/sd-webui.log"
echo "🔍 Check process: ps aux | grep launch.py"
echo "🌐 API will be available at: http://83.10.113.244:7860"
echo ""
echo "⏳ Wait 2-3 minutes for the service to fully initialize..."
echo "   The first startup may take longer as it downloads additional dependencies..."

