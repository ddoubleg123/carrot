#!/bin/bash
# Setup script for Vast.ai Ghibli Worker

echo "🚀 Setting up Ghibli AI Worker on Vast.ai..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python dependencies
pip install fastapi uvicorn python-multipart

# Create outputs directory
mkdir -p ./outputs

# Make the worker script executable
chmod +x vast-ai-worker-complete.py

# Install your AI model dependencies (uncomment as needed)
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
# pip install diffusers transformers accelerate safetensors Pillow

echo "✅ Setup complete!"
echo "📝 To start the worker, run:"
echo "   python vast-ai-worker-complete.py"
echo ""
echo "🌐 The worker will be available at:"
echo "   http://localhost:8000"
echo "   Health check: http://localhost:8000/health"
echo "   Cleanup: http://localhost:8000/cleanup"
echo "   Generate: http://localhost:8000/generate-image"
