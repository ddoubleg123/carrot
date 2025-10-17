#!/bin/bash
# Full SDXL + CodeFormer + RealESRGAN Setup Script
# This installs all dependencies for crisp, photorealistic faces

set -e  # Exit on error

echo "🚀 Starting Full SDXL Setup..."
echo ""

# Step 1: Install PyTorch and dependencies
echo "📦 Step 1/5: Installing PyTorch and core dependencies..."
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate safetensors pillow
pip install fastapi uvicorn python-multipart
echo "✅ PyTorch and core dependencies installed"
echo ""

# Step 2: Install BasicSR and FaceLib (for CodeFormer)
echo "📦 Step 2/5: Installing BasicSR and FaceLib..."
pip install basicsr facexlib
echo "✅ BasicSR and FaceLib installed"
echo ""

# Step 3: Install CodeFormer
echo "📦 Step 3/5: Installing CodeFormer..."
cd /root
if [ -d "CodeFormer" ]; then
    echo "   CodeFormer directory exists, removing..."
    rm -rf CodeFormer
fi

git clone https://github.com/sczhou/CodeFormer.git
cd CodeFormer

# Install CodeFormer dependencies
pip install -r requirements.txt

# Download CodeFormer weights
echo "   Downloading CodeFormer weights..."
mkdir -p weights/CodeFormer
mkdir -p weights/facelib

# Download CodeFormer model
wget https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth -O weights/CodeFormer/codeformer.pth

# Download face detection models
wget https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth -O weights/facelib/detection_Resnet50_Final.pth
wget https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth -O weights/facelib/parsing_parsenet.pth

echo "✅ CodeFormer installed and weights downloaded"
echo ""

# Step 4: Install RealESRGAN
echo "📦 Step 4/5: Installing RealESRGAN..."
cd /root
pip install realesrgan

# Download RealESRGAN weights
mkdir -p weights
wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth -O weights/RealESRGAN_x2plus.pth

echo "✅ RealESRGAN installed and weights downloaded"
echo ""

# Step 5: Verify installation
echo "📦 Step 5/5: Verifying installation..."
python3 -c "
import torch
import diffusers
from basicsr.archs.codeformer_arch import CodeFormer
from realesrgan import RealESRGAN
print('✅ All imports successful!')
print(f'   PyTorch: {torch.__version__}')
print(f'   Diffusers: {diffusers.__version__}')
print(f'   CUDA: {torch.cuda.is_available()}')
"

echo ""
echo "🎉 Full SDXL Setup Complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Start the API: cd /root && python3 upgraded-sdxl-api.py"
echo "   2. Test from local machine via tunnel"
echo ""

