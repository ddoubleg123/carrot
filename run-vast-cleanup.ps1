# PowerShell script to run Vast.ai cleanup
Write-Host "🚀 Connecting to Vast.ai server and running cleanup..." -ForegroundColor Green

# SSH command to connect and run cleanup
$sshCommand = @"
echo "🚀 VAST.AI DISK CLEANUP SCRIPT"
echo "================================"

echo "📊 Step 1: Check current disk usage"
df -h /

echo ""
echo "📁 Step 2: Check what is using space in /root"
du -h --max-depth=1 /root | sort -rh | head -10

echo ""
echo "🤗 Step 3: Check HuggingFace cache size"
du -sh /root/.cache/huggingface 2>/dev/null || echo "No HuggingFace cache found"

echo ""
echo "🧹 Step 4: Running cleanup commands..."
rm -rf /root/pytorch_wheels /root/.cache/pip /root/.cache/conda /root/setup.log
apt-get clean
rm -rf /tmp/* /var/tmp/*
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
echo "✅ Cleanup complete!"
"@

# Execute SSH command
Write-Host "Connecting to ssh4.vast.ai:14688..." -ForegroundColor Yellow
ssh -p 14688 root@ssh4.vast.ai "$sshCommand"
