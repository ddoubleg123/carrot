#!/bin/bash
# Comprehensive Vast.ai cleanup script
# Checks and removes: PyTorch wheels, caches, generated images, temp files

echo "=========================================="
echo "Vast.ai Comprehensive Cleanup"
echo "=========================================="

echo ""
echo "BEFORE cleanup:"
df -h / | grep -E '(Filesystem|/dev)'

SPACE_FREED=0

# 1. PyTorch wheels (2.2GB)
echo ""
echo "1. PyTorch Wheels..."
if [ -d "/root/pytorch_wheels" ]; then
    SIZE=$(du -sm /root/pytorch_wheels | cut -f1)
    rm -rf /root/pytorch_wheels
    SPACE_FREED=$((SPACE_FREED + SIZE))
    echo "   ✓ Deleted $SIZE MB"
else
    echo "   ✓ Already deleted"
fi

# 2. Pip cache (268MB)
echo ""
echo "2. Pip Cache..."
if [ -d "/root/.cache/pip" ]; then
    SIZE=$(du -sm /root/.cache/pip | cut -f1)
    rm -rf /root/.cache/pip
    SPACE_FREED=$((SPACE_FREED + SIZE))
    echo "   ✓ Deleted $SIZE MB"
else
    echo "   ✓ Already cleared"
fi

# 3. Conda cache
echo ""
echo "3. Conda Cache..."
if [ -d "/root/.cache/conda" ]; then
    SIZE=$(du -sm /root/.cache/conda | cut -f1)
    rm -rf /root/.cache/conda
    SPACE_FREED=$((SPACE_FREED + SIZE))
    echo "   ✓ Deleted $SIZE MB"
else
    echo "   ✓ Already cleared"
fi

# 4. Generated images (if Ghibli worker was used)
echo ""
echo "4. Generated Images..."
if [ -d "/srv/outputs" ]; then
    NUM_FILES=$(find /srv/outputs -type f | wc -l)
    SIZE=$(du -sm /srv/outputs | cut -f1)
    if [ $NUM_FILES -gt 0 ]; then
        rm -rf /srv/outputs/*
        SPACE_FREED=$((SPACE_FREED + SIZE))
        echo "   ✓ Deleted $NUM_FILES images ($SIZE MB)"
    else
        echo "   ✓ Directory empty"
    fi
else
    echo "   ✓ No images directory"
fi

# 5. Temp files
echo ""
echo "5. Temp Files..."
TEMP_SIZE=0
if [ -d "/tmp" ]; then
    TMP_SIZE=$(du -sm /tmp 2>/dev/null | cut -f1 || echo 0)
    rm -rf /tmp/* 2>/dev/null
    TEMP_SIZE=$((TEMP_SIZE + TMP_SIZE))
fi
if [ -d "/var/tmp" ]; then
    VARTMP_SIZE=$(du -sm /var/tmp 2>/dev/null | cut -f1 || echo 0)
    rm -rf /var/tmp/* 2>/dev/null
    TEMP_SIZE=$((TEMP_SIZE + VARTMP_SIZE))
fi
SPACE_FREED=$((SPACE_FREED + TEMP_SIZE))
echo "   ✓ Cleared $TEMP_SIZE MB"

# 6. Setup log
echo ""
echo "6. Setup Log..."
if [ -f "/root/setup.log" ]; then
    rm -f /root/setup.log
    echo "   ✓ Deleted"
else
    echo "   ✓ Already deleted"
fi

# 7. APT cache
echo ""
echo "7. APT Cache..."
apt-get clean 2>/dev/null
echo "   ✓ Cleared"

# 8. Python cache files
echo ""
echo "8. Python Cache Files..."
PYCOUNT=$(find /root -type d -name __pycache__ 2>/dev/null | wc -l)
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null
echo "   ✓ Deleted $PYCOUNT __pycache__ directories"

# 9. Docker (if installed)
echo ""
echo "9. Docker..."
if command -v docker &> /dev/null; then
    docker system prune -af --volumes 2>/dev/null && echo "   ✓ Docker cleaned" || echo "   ✓ No Docker containers"
else
    echo "   ✓ Docker not installed"
fi

echo ""
echo "=========================================="
echo "AFTER cleanup:"
df -h / | grep -E '(Filesystem|/dev)'
echo ""
echo "Estimated space freed: ~$((SPACE_FREED / 1000))GB"
echo "=========================================="

echo ""
echo "Remaining large directories:"
du -h --max-depth=1 /root 2>/dev/null | sort -rh | head -5

echo ""
echo "HuggingFace models (keep these!):"
du -sh /root/.cache/huggingface 2>/dev/null || echo "No HuggingFace cache"

