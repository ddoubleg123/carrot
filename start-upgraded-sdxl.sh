#!/bin/bash
# Start the Upgraded SDXL API on Vast.ai
# This script starts the SDXL + CodeFormer + RealESRGAN API

echo "🚀 Starting Upgraded SDXL API with CodeFormer + RealESRGAN..."
echo ""
echo "📦 Features enabled:"
echo "   ✅ SDXL Base + Refiner"
echo "   ✅ CodeFormer face restoration"
echo "   ✅ RealESRGAN neural upscaling"
echo "   ✅ Hires Fix (768→1536)"
echo ""
echo "⏳ First-time startup will download models (~15GB, 30-40 mins)"
echo "   After first run, startup is instant!"
echo ""

cd /root

# Make sure we're using the upgraded API
if [ ! -f "upgraded-sdxl-api.py" ]; then
    echo "❌ Error: upgraded-sdxl-api.py not found in /root"
    exit 1
fi

# Start the API
echo "🎨 Starting FastAPI server on port 7860..."
echo ""
python3 upgraded-sdxl-api.py

