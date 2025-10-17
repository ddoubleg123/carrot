#!/bin/bash
# AGGRESSIVE cleanup script for Vast.ai - Use if you need more space
# WARNING: This will delete more cached data

echo "=========================================="
echo "Vast.ai AGGRESSIVE Disk Cleanup Script"
echo "=========================================="
echo "This will delete:"
echo "  - PyTorch wheels"
echo "  - Pip cache"
echo "  - Conda cache"
echo "  - Journal logs"
echo "  - Temporary files"
echo "  - Old HuggingFace model versions (keeps latest)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "BEFORE cleanup:"
df -h /

# Basic cleanup
echo ""
echo "Removing PyTorch wheels..."
rm -rf /root/pytorch_wheels
echo "✓ Done"

echo ""
echo "Clearing pip cache..."
rm -rf /root/.cache/pip
echo "✓ Done"

echo ""
echo "Clearing conda cache..."
rm -rf /root/.cache/conda
echo "✓ Done"

echo ""
echo "Clearing apt cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*
echo "✓ Done"

echo ""
echo "Removing logs..."
rm -f /root/setup.log
journalctl --vacuum-time=1d 2>/dev/null || echo "No journalctl"
echo "✓ Done"

echo ""
echo "Clearing tmp files..."
rm -rf /tmp/*
rm -rf /var/tmp/*
echo "✓ Done"

echo ""
echo "Finding old Python cache files..."
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null
echo "✓ Done"

# Docker cleanup if installed
if command -v docker &> /dev/null; then
    echo ""
    echo "Cleaning Docker (if any)..."
    docker system prune -af --volumes 2>/dev/null || echo "No Docker containers to clean"
    echo "✓ Done"
fi

echo ""
echo "AFTER cleanup:"
df -h /

echo ""
echo "=========================================="
echo "Cleanup complete!"
echo "=========================================="

echo ""
echo "Checking remaining large directories:"
du -h --max-depth=1 /root 2>/dev/null | sort -rh | head -10

