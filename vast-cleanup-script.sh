#!/bin/bash

echo "🚀 VAST.AI DISK CLEANUP SCRIPT"
echo "================================"

echo "📊 Step 1: Check current disk usage"
df -h /

echo ""
echo "📁 Step 2: Check what's using space in /root"
du -h --max-depth=1 /root | sort -rh | head -10

echo ""
echo "🤗 Step 3: Check HuggingFace cache size"
du -sh /root/.cache/huggingface 2>/dev/null || echo "No HuggingFace cache found"

echo ""
echo "🧹 Step 4: Running cleanup commands..."
echo "Removing PyTorch wheels..."
rm -rf /root/pytorch_wheels

echo "Clearing pip cache..."
rm -rf /root/.cache/pip

echo "Clearing conda cache..."
rm -rf /root/.cache/conda

echo "Removing setup log..."
rm -f /root/setup.log

echo "Clearing apt cache..."
apt-get clean

echo "Clearing temp files..."
rm -rf /tmp/* /var/tmp/*

echo "Clearing Python cache..."
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null

echo ""
echo "📊 Step 5: Check space after cleanup"
df -h /

echo ""
echo "🤗 Step 6: Analyze HuggingFace cache contents"
if [ -d "/root/.cache/huggingface" ]; then
    echo "HuggingFace cache contents:"
    du -h --max-depth=2 /root/.cache/huggingface | sort -rh | head -15
    echo ""
    echo "Total HuggingFace cache size:"
    du -sh /root/.cache/huggingface
else
    echo "No HuggingFace cache found"
fi

echo ""
echo "✅ Cleanup complete! Check the space freed above."
echo "If you need more space, we can clean HuggingFace cache next."
