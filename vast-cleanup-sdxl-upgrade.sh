#!/bin/bash
# VAST.AI SDXL UPGRADE - STEP 1: DISK CLEANUP
# This script frees up space on your Vast.ai instance for SDXL models

echo "=========================================="
echo "VAST.AI DISK CLEANUP FOR SDXL UPGRADE"
echo "=========================================="
echo ""

echo "📊 Current disk usage:"
df -h /
echo ""

echo "🧹 Starting cleanup..."
echo ""

# Basic cleanup
echo "1. Removing PyTorch wheels and caches..."
rm -rf /root/pytorch_wheels 2>/dev/null
rm -rf /root/.cache/pip 2>/dev/null
rm -rf /root/.cache/conda 2>/dev/null
rm -rf /root/setup.log 2>/dev/null

echo "2. Cleaning apt cache..."
apt-get clean 2>/dev/null

echo "3. Removing temp files..."
rm -rf /tmp/* 2>/dev/null
rm -rf /var/tmp/* 2>/dev/null

echo "4. Removing Python cache files..."
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null

echo "5. Removing Docker artifacts..."
docker system prune -af --volumes 2>/dev/null

echo ""
echo "📊 Disk usage after basic cleanup:"
df -h /
echo ""

echo "🔍 Analyzing HuggingFace cache..."
echo "Total HuggingFace cache size:"
du -sh /root/.cache/huggingface 2>/dev/null
echo ""

echo "Top 20 largest directories in HuggingFace cache:"
du -h --max-depth=2 /root/.cache/huggingface 2>/dev/null | sort -rh | head -20
echo ""

echo "⚠️  MANUAL STEP REQUIRED:"
echo "Review the cache directories above and decide what to remove."
echo "To remove SD 1.5 models (if you don't need them):"
echo "  rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5"
echo ""
echo "To remove Git history from models (saves significant space):"
echo "  rm -rf /root/.cache/huggingface/hub/models--*/.git"
echo ""

echo "📊 Final disk usage:"
df -h /
echo ""

echo "✅ Cleanup script completed!"
echo "Target: 20GB+ free space needed for SDXL upgrade"
echo ""

