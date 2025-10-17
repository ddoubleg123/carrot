#!/bin/bash
# Remote status check script - runs on Vast.ai

echo "==========================================" 
echo "VAST.AI SERVER STATUS REPORT"
echo "=========================================="
echo ""

echo "📊 DISK SPACE:"
echo "---"
df -h /
echo ""

echo "📦 HUGGINGFACE CACHE SIZE:"
echo "---"
du -sh /root/.cache/huggingface 2>/dev/null || echo "No HuggingFace cache found"
echo ""

echo "📁 MODELS IN CACHE:"
echo "---"
ls -la /root/.cache/huggingface/hub/ 2>/dev/null | grep -E "models--" | head -20 || echo "No models found"
echo ""

echo "🐍 INSTALLED PYTHON PACKAGES:"
echo "---"
pip list 2>/dev/null | grep -E "torch|diffusers|transformers|fastapi|basicsr|realesrgan|accelerate|safetensors" || echo "Packages not found"
echo ""

echo "🔧 PYTHON & CUDA:"
echo "---"
python3 --version
python3 -c "import torch; print('PyTorch:', torch.__version__); print('CUDA Available:', torch.cuda.is_available())" 2>/dev/null || echo "PyTorch not installed"
echo ""

echo "🎮 GPU STATUS:"
echo "---"
nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader
echo ""

echo "🚀 RUNNING PROCESSES:"
echo "---"
ps aux | grep python | grep -v grep || echo "No Python processes running"
echo ""

echo "📄 UPLOADED FILES:"
echo "---"
ls -lh /root/*.py /root/*.sh 2>/dev/null | tail -20 || echo "No scripts found"
echo ""

echo "==========================================" 
echo "STATUS REPORT COMPLETE"
echo "=========================================="


