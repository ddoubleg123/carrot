#!/bin/bash
# Cleanup script for Vast.ai server - Free up disk space

echo "=========================================="
echo "Vast.ai Disk Cleanup Script"
echo "=========================================="

# Show current disk usage
echo ""
echo "BEFORE cleanup:"
df -h /

echo ""
echo "----------------------------------------"
echo "Step 1: Delete PyTorch wheel files (2.2G)"
echo "These were only needed for installation"
echo "----------------------------------------"
if [ -d "/root/pytorch_wheels" ]; then
    du -sh /root/pytorch_wheels
    rm -rf /root/pytorch_wheels
    echo "✓ Deleted /root/pytorch_wheels"
else
    echo "✓ Already deleted"
fi

echo ""
echo "----------------------------------------"
echo "Step 2: Clear pip cache (268M)"
echo "----------------------------------------"
if [ -d "/root/.cache/pip" ]; then
    du -sh /root/.cache/pip
    rm -rf /root/.cache/pip
    echo "✓ Cleared pip cache"
else
    echo "✓ Already cleared"
fi

echo ""
echo "----------------------------------------"
echo "Step 3: Delete setup log (980K)"
echo "----------------------------------------"
if [ -f "/root/setup.log" ]; then
    rm -f /root/setup.log
    echo "✓ Deleted setup.log"
else
    echo "✓ Already deleted"
fi

echo ""
echo "----------------------------------------"
echo "Step 4: Clear apt cache"
echo "----------------------------------------"
apt-get clean
echo "✓ Cleared apt cache"

echo ""
echo "----------------------------------------"
echo "Step 5: Find HuggingFace cache size"
echo "This should NOT be deleted (SDXL models)"
echo "----------------------------------------"
if [ -d "/root/.cache/huggingface" ]; then
    du -sh /root/.cache/huggingface
else
    echo "No HuggingFace cache found"
fi

echo ""
echo "----------------------------------------"
echo "Step 6: Check for large files/directories"
echo "----------------------------------------"
echo "Largest directories in /root:"
du -h --max-depth=1 /root 2>/dev/null | sort -rh | head -10

echo ""
echo "----------------------------------------"
echo "Step 7: Check Docker usage (if installed)"
echo "----------------------------------------"
if command -v docker &> /dev/null; then
    echo "Docker images:"
    docker images
    echo ""
    echo "Docker containers:"
    docker ps -a
    echo ""
    echo "To clean Docker: docker system prune -a"
else
    echo "Docker not installed"
fi

echo ""
echo "=========================================="
echo "AFTER cleanup:"
df -h /
echo "=========================================="

echo ""
echo "Space freed! Summary of safe deletions:"
echo "  - PyTorch wheels: ~2.2G"
echo "  - Pip cache: ~268M"
echo "  - Setup log: ~1M"
echo "  - Apt cache: varies"
echo ""
echo "Total estimated freed: ~2.5GB"

