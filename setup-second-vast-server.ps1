# Setup Script for Second Vast.ai Server
# Configures SSH connection and deploys SDXL upgrade

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SECOND VAST.AI SERVER SETUP" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Your second server details
$SECOND_SERVER_HOST = "111.59.36.106"  # Direct connection
$SECOND_SERVER_PORT = "30400"          # Direct SSH port
$SECOND_SERVER_HOST_PROXY = "ssh1.vast.ai"  # Proxy connection (alternative)
$SECOND_SERVER_PORT_PROXY = "28963"         # Proxy SSH port
$SSH_KEY_PATH = "$env:USERPROFILE\.ssh\vast-sdxl-server-key"

Write-Host "⚠️  IMPORTANT: Update the configuration variables above!" -ForegroundColor Red
Write-Host "   - SECOND_SERVER_HOST: Your server's SSH host" -ForegroundColor Yellow
Write-Host "   - SECOND_SERVER_PORT: Your server's SSH port" -ForegroundColor Yellow
Write-Host ""

if ($SECOND_SERVER_HOST -eq "YOUR_SECOND_SERVER_HOST" -or $SECOND_SERVER_PORT -eq "YOUR_SECOND_SERVER_PORT") {
    Write-Host "❌ Please update the configuration variables first!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Edit this script and update:" -ForegroundColor Yellow
    Write-Host "   SECOND_SERVER_HOST = `"your-actual-host`"" -ForegroundColor White
    Write-Host "   SECOND_SERVER_PORT = `"your-actual-port`"" -ForegroundColor White
    exit 1
}

Write-Host "🔧 Configuration:" -ForegroundColor Yellow
Write-Host "   Direct Host: $SECOND_SERVER_HOST" -ForegroundColor White
Write-Host "   Direct Port: $SECOND_SERVER_PORT" -ForegroundColor White
Write-Host "   Proxy Host: $SECOND_SERVER_HOST_PROXY" -ForegroundColor White
Write-Host "   Proxy Port: $SECOND_SERVER_PORT_PROXY" -ForegroundColor White
Write-Host "   SSH Key: $SSH_KEY_PATH" -ForegroundColor White
Write-Host ""

# Check if SSH key exists
if (!(Test-Path $SSH_KEY_PATH)) {
    Write-Host "❌ SSH key not found at: $SSH_KEY_PATH" -ForegroundColor Red
    Write-Host "Run create-ssh-key-for-vast.ps1 first!" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ SSH key found" -ForegroundColor Green
Write-Host ""

# Test SSH connection (try direct first, then proxy)
Write-Host "🔍 Testing SSH connection..." -ForegroundColor Yellow

# Try direct connection first
Write-Host "   Trying direct connection..." -ForegroundColor Gray
$testResult = ssh -p $SECOND_SERVER_PORT -o ConnectTimeout=10 -o BatchMode=yes root@$SECOND_SERVER_HOST "echo 'Direct SSH connection successful'" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "   Direct connection failed, trying proxy..." -ForegroundColor Yellow
    $SECOND_SERVER_HOST = $SECOND_SERVER_HOST_PROXY
    $SECOND_SERVER_PORT = $SECOND_SERVER_PORT_PROXY
    $testResult = ssh -p $SECOND_SERVER_PORT -o ConnectTimeout=10 -o BatchMode=yes root@$SECOND_SERVER_HOST "echo 'Proxy SSH connection successful'" 2>&1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSH connection successful!" -ForegroundColor Green
} else {
    Write-Host "❌ SSH connection failed:" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure you added the public key to Vast.ai" -ForegroundColor White
    Write-Host "2. Verify host and port are correct" -ForegroundColor White
    Write-Host "3. Check if the instance is running" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "📤 Uploading SDXL upgrade files..." -ForegroundColor Yellow

# Upload files to second server
$files = @(
    "vast-cleanup-sdxl-upgrade.sh",
    "install-sdxl-packages.sh", 
    "upgraded-sdxl-api.py",
    "test-upgraded-sdxl-api.js"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "   Uploading $file..." -ForegroundColor Gray
        scp -P $SECOND_SERVER_PORT $file root@${SECOND_SERVER_HOST}:/root/
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $file uploaded" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Failed to upload $file" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⚠️  $file not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🚀 Starting SDXL upgrade on second server..." -ForegroundColor Yellow
Write-Host "This will take 30-40 minutes..." -ForegroundColor Gray
Write-Host ""

# Execute upgrade on second server
$upgradeCommands = @"
echo "=========================================="
echo "SDXL UPGRADE - SECOND SERVER"
echo "=========================================="
echo ""

# Make scripts executable
chmod +x vast-cleanup-sdxl-upgrade.sh
chmod +x install-sdxl-packages.sh

# Step 1: Cleanup
echo "🧹 Step 1: Disk cleanup..."
./vast-cleanup-sdxl-upgrade.sh

# Step 2: Install packages
echo "📦 Step 2: Installing packages..."
./install-sdxl-packages.sh

# Step 3: Start API
echo "🚀 Step 3: Starting SDXL API..."
pkill -f upgraded-sdxl-api.py 2>/dev/null
nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &

echo "✅ SDXL API started on second server!"
echo ""
echo "📊 Monitor with: tail -f /root/sdxl-api.log"
echo "🔍 Check health: curl http://localhost:7860/health"
"@

ssh -p $SECOND_SERVER_PORT root@$SECOND_SERVER_HOST $upgradeCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Second server setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Wait 10-15 minutes for models to download" -ForegroundColor White
    Write-Host "2. Test the second server" -ForegroundColor White
    Write-Host "3. Set up load balancing in your app" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Test second server:" -ForegroundColor Yellow
    Write-Host "ssh -p $SECOND_SERVER_PORT root@$SECOND_SERVER_HOST" -ForegroundColor White
    Write-Host "🔧 SSH Tunnel for local access:" -ForegroundColor Yellow
    Write-Host "ssh -p $SECOND_SERVER_PORT root@$SECOND_SERVER_HOST -L 7861:localhost:7860" -ForegroundColor White
} else {
    Write-Host "❌ Setup failed on second server" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SECOND SERVER SETUP COMPLETE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
