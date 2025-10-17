#!/bin/bash
# Full SDXL + CodeFormer + RealESRGAN Setup with Compatible PyTorch
# Run setup-sdxl-compatible-pytorch.sh FIRST to install compatible PyTorch versions

set -e  # Exit on error

echo "🚀 Starting Full SDXL Setup with Compatible Dependencies..."
echo ""

# Verify PyTorch version first
echo "🔍 Checking PyTorch version..."
TORCH_VERSION=$(python3 -c "import torch; print(torch.__version__)" 2>/dev/null || echo "not_installed")

if [[ $TORCH_VERSION != 2.0.* ]]; then
    echo "❌ Wrong PyTorch version: $TORCH_VERSION"
    echo ""
    echo "Please run setup-sdxl-compatible-pytorch.sh first:"
    echo "   bash setup-sdxl-compatible-pytorch.sh"
    echo ""
    exit 1
fi

echo "✅ PyTorch $TORCH_VERSION - Compatible!"
echo ""

# Step 1: Install core dependencies (without torch - already installed)
echo "📦 Step 1/5: Installing core dependencies..."
pip install --upgrade pip
pip install diffusers transformers accelerate safetensors pillow
pip install fastapi uvicorn python-multipart
echo "✅ Core dependencies installed"
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

# Install CodeFormer dependencies (but skip torch - already installed)
echo "   Installing CodeFormer dependencies..."
# Filter out torch from requirements to avoid reinstalling
grep -v "^torch" requirements.txt > requirements_no_torch.txt || true
pip install -r requirements_no_torch.txt || true

# Download CodeFormer weights
echo "   Downloading CodeFormer weights..."
mkdir -p weights/CodeFormer
mkdir -p weights/facelib

# Download CodeFormer model
wget -c https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth \
    -O weights/CodeFormer/codeformer.pth \
    --tries=0 --timeout=60

# Download face detection models
wget -c https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth \
    -O weights/facelib/detection_Resnet50_Final.pth \
    --tries=0 --timeout=60

wget -c https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth \
    -O weights/facelib/parsing_parsenet.pth \
    --tries=0 --timeout=60

echo "✅ CodeFormer installed and weights downloaded"
echo ""

# Step 4: Install RealESRGAN
echo "📦 Step 4/5: Installing RealESRGAN..."
cd /root
pip install realesrgan

# Download RealESRGAN weights
mkdir -p weights
wget -c https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth \
    -O weights/RealESRGAN_x2plus.pth \
    --tries=0 --timeout=60

echo "✅ RealESRGAN installed and weights downloaded"
echo ""

# Step 5: Verify installation
echo "📦 Step 5/5: Verifying full installation..."
python3 -c "
import sys
import torch
import torchvision
import diffusers
from basicsr.archs.codeformer_arch import CodeFormer
from realesrgan import RealESRGAN

print('✅ All imports successful!')
print(f'   PyTorch: {torch.__version__}')
print(f'   torchvision: {torchvision.__version__}')
print(f'   Diffusers: {diffusers.__version__}')
print(f'   CUDA: {torch.cuda.is_available()}')

if torch.cuda.is_available():
    print(f'   GPU: {torch.cuda.get_device_name(0)}')

# Check for the problematic import
try:
    from torchvision.transforms.functional_tensor import rgb_to_grayscale
    print('✅ torchvision.transforms.functional_tensor available!')
except ImportError as e:
    print(f'⚠️  Import issue: {e}')
    sys.exit(1)
"

echo ""
echo "🎉 Full SDXL Setup Complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Upload upgraded-sdxl-api.py to /root"
echo "   2. Start the API: python3 /root/upgraded-sdxl-api.py"
echo "   3. Test from local machine via tunnel"
echo ""
echo "📊 Disk usage:"
du -sh /root/CodeFormer 2>/dev/null || true
du -sh /root/.cache/huggingface 2>/dev/null || true
echo ""

