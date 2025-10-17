#!/bin/bash
# VAST.AI SDXL UPGRADE - STEP 2: INSTALL PACKAGES
# Installs all required dependencies for SDXL with face restoration

echo "=========================================="
echo "SDXL PACKAGE INSTALLATION"
echo "=========================================="
echo ""

echo "🔍 Checking Python and CUDA availability..."
python --version
python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')" 2>/dev/null || echo "PyTorch not found or needs update"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""

echo "📦 Installing PyTorch with CUDA 12.1 support..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
echo ""

echo "📦 Installing diffusers and transformers..."
pip install diffusers transformers accelerate safetensors
echo ""

echo "📦 Installing image processing libraries..."
pip install pillow opencv-python-headless
echo ""

echo "📦 Installing face restoration dependencies..."
pip install basicsr facexlib insightface realesrgan
echo ""

echo "📦 Installing FastAPI and dependencies..."
pip install fastapi uvicorn python-multipart pydantic
echo ""

echo "📦 Installing CodeFormer..."
if [ -d "CodeFormer" ]; then
    echo "CodeFormer directory already exists, pulling latest changes..."
    cd CodeFormer && git pull && cd ..
else
    git clone https://github.com/sczhou/CodeFormer.git
    cd CodeFormer && pip install -r requirements.txt && cd ..
fi
echo ""

echo "📦 Installing additional utilities..."
pip install numpy scipy tqdm
echo ""

echo "✅ Verifying installations..."
python -c "import torch; print(f'✓ PyTorch {torch.__version__}')"
python -c "import diffusers; print(f'✓ Diffusers {diffusers.__version__}')"
python -c "import transformers; print(f'✓ Transformers {transformers.__version__}')"
python -c "import PIL; print(f'✓ Pillow {PIL.__version__}')"
python -c "import fastapi; print(f'✓ FastAPI {fastapi.__version__}')"
python -c "import basicsr; print('✓ BasicSR installed')"
echo ""

echo "🎮 GPU Information:"
nvidia-smi
echo ""

echo "✅ Package installation completed!"
echo "Ready to proceed with model downloads and API setup."
echo ""

