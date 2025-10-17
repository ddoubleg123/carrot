#!/bin/bash
# Robust PyTorch Downgrade for CodeFormer/RealESRGAN Compatibility
# Downloads wheels with wget (resumable) then installs locally

set -e  # Exit on error

echo "🚀 Downgrading PyTorch for CodeFormer/RealESRGAN compatibility..."
echo ""
echo "Target versions:"
echo "   - torch 2.0.1+cu118"
echo "   - torchvision 0.15.2+cu118"
echo "   - torchaudio 2.0.2+cu118"
echo ""

cd /root

# Create temp directory for wheels
mkdir -p pytorch_wheels
cd pytorch_wheels

echo "📦 Step 1/4: Downloading PyTorch 2.0.1 (2.3GB, resumable)..."
echo "   This may take 10-15 minutes depending on connection speed"
echo "   If interrupted, just re-run - wget will resume from where it left off!"
echo ""

# Download torch wheel with resume capability
wget -c https://download.pytorch.org/whl/cu118/torch-2.0.1%2Bcu118-cp310-cp310-linux_x86_64.whl \
    --progress=bar:force:noscroll \
    --tries=0 \
    --timeout=60 \
    --waitretry=5

echo ""
echo "✅ PyTorch wheel downloaded successfully"
echo ""

echo "📦 Step 2/4: Downloading torchvision 0.15.2 (700MB, resumable)..."
echo ""

# Download torchvision wheel with resume capability
wget -c https://download.pytorch.org/whl/cu118/torchvision-0.15.2%2Bcu118-cp310-cp310-linux_x86_64.whl \
    --progress=bar:force:noscroll \
    --tries=0 \
    --timeout=60 \
    --waitretry=5

echo ""
echo "✅ torchvision wheel downloaded successfully"
echo ""

echo "📦 Step 3/4: Downloading torchaudio 2.0.2 (smaller, quick)..."
echo ""

# Download torchaudio wheel
wget -c https://download.pytorch.org/whl/cu118/torchaudio-2.0.2%2Bcu118-cp310-cp310-linux_x86_64.whl \
    --progress=bar:force:noscroll \
    --tries=0 \
    --timeout=60 \
    --waitretry=5

echo ""
echo "✅ torchaudio wheel downloaded successfully"
echo ""

echo "📦 Step 4/4: Installing PyTorch from local wheels..."
echo "   Uninstalling current versions first..."

# Uninstall current versions
pip uninstall -y torch torchvision torchaudio || true

echo ""
echo "   Installing torch 2.0.1..."
pip install torch-2.0.1+cu118-cp310-cp310-linux_x86_64.whl

echo ""
echo "   Installing torchvision 0.15.2..."
pip install torchvision-0.15.2+cu118-cp310-cp310-linux_x86_64.whl

echo ""
echo "   Installing torchaudio 2.0.2..."
pip install torchaudio-2.0.2+cu118-cp310-cp310-linux_x86_64.whl

echo ""
echo "✅ PyTorch installation complete!"
echo ""

# Verify installation
echo "🔍 Verifying installation..."
python3 -c "
import torch
import torchvision
print('✅ Verification successful!')
print(f'   torch: {torch.__version__}')
print(f'   torchvision: {torchvision.__version__}')
print(f'   CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'   GPU: {torch.cuda.get_device_name(0)}')
"

echo ""
echo "🎉 PyTorch downgrade complete!"
echo ""
echo "📝 Next: Run the full SDXL setup:"
echo "   bash setup-sdxl-full-compatible.sh"
echo ""

