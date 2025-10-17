#!/bin/bash
# Copy and paste this entire script into your Vast.ai SSH session

echo "Starting cleanup..."
echo "BEFORE:"
df -h / | grep -E '(Filesystem|/dev)'

# Delete PyTorch wheels (2.2GB)
if [ -d "/root/pytorch_wheels" ]; then
    echo "Deleting PyTorch wheels (2.2GB)..."
    rm -rf /root/pytorch_wheels
    echo "✓ Deleted"
fi

# Clear pip cache (268MB)
if [ -d "/root/.cache/pip" ]; then
    echo "Clearing pip cache (268MB)..."
    rm -rf /root/.cache/pip
    echo "✓ Cleared"
fi

# Clear conda cache
if [ -d "/root/.cache/conda" ]; then
    echo "Clearing conda cache..."
    rm -rf /root/.cache/conda
    echo "✓ Cleared"
fi

# Delete setup log
if [ -f "/root/setup.log" ]; then
    echo "Deleting setup.log..."
    rm -f /root/setup.log
    echo "✓ Deleted"
fi

# Clear apt cache
echo "Clearing apt cache..."
apt-get clean
echo "✓ Cleared"

# Clear temp files
echo "Clearing temp files..."
rm -rf /tmp/* /var/tmp/* 2>/dev/null
echo "✓ Cleared"

# Remove Python cache
echo "Removing Python cache files..."
find /root -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find /root -type f -name "*.pyc" -delete 2>/dev/null
echo "✓ Cleared"

echo ""
echo "AFTER:"
df -h / | grep -E '(Filesystem|/dev)'

echo ""
echo "Cleanup complete! Space freed: ~2.5GB+"
echo ""
echo "Largest directories remaining:"
du -h --max-depth=1 /root 2>/dev/null | sort -rh | head -5

