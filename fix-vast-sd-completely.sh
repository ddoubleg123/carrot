#!/bin/bash
set -e

echo "========================================="
echo "STEP 1: Killing all Python processes"
echo "========================================="
pkill -9 python3 || true
sleep 2

echo ""
echo "========================================="
echo "STEP 2: Uninstalling ALL pip packages"
echo "========================================="
pip freeze | xargs pip uninstall -y || true

echo ""
echo "========================================="
echo "STEP 3: Installing compatible versions"
echo "========================================="
pip install --no-cache-dir torch==2.4.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cu121
pip install --no-cache-dir diffusers==0.30.0 transformers==4.44.0 accelerate==0.33.0 safetensors==0.4.4
pip install --no-cache-dir fastapi==0.115.0 uvicorn==0.30.6 pillow==10.4.0

echo ""
echo "========================================="
echo "STEP 4: Verifying installation"
echo "========================================="
python3 -c "import torch; print(f'PyTorch: {torch.__version__}')"
python3 -c "import diffusers; print(f'Diffusers: {diffusers.__version__}')"
python3 -c "from diffusers import StableDiffusionPipeline; print('✓ StableDiffusionPipeline imports successfully')"

echo ""
echo "========================================="
echo "✅ Installation complete!"
echo "========================================="

