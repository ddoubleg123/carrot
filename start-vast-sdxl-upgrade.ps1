# PowerShell script to execute SDXL upgrade on Vast.ai
# Run this from your local Windows machine

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VAST.AI SDXL UPGRADE - AUTOMATED SETUP" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$VAST_HOST = "ssh4.vast.ai"
$VAST_PORT = "14688"
$VAST_USER = "root"

Write-Host "🔧 Configuration:" -ForegroundColor Yellow
Write-Host "  Host: $VAST_HOST"
Write-Host "  Port: $VAST_PORT"
Write-Host "  User: $VAST_USER"
Write-Host ""

# Step 1: Upload cleanup script
Write-Host "📤 Step 1: Uploading cleanup script..." -ForegroundColor Cyan
scp -P $VAST_PORT "vast-cleanup-sdxl-upgrade.sh" "${VAST_USER}@${VAST_HOST}:/root/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload cleanup script" -ForegroundColor Red
    exit 1
}

# Step 2: Upload installation script
Write-Host "📤 Step 2: Uploading installation script..." -ForegroundColor Cyan
scp -P $VAST_PORT "install-sdxl-packages.sh" "${VAST_USER}@${VAST_HOST}:/root/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload installation script" -ForegroundColor Red
    exit 1
}

# Step 3: Upload API file
Write-Host "📤 Step 3: Uploading upgraded API..." -ForegroundColor Cyan
scp -P $VAST_PORT "upgraded-sdxl-api.py" "${VAST_USER}@${VAST_HOST}:/root/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload API file" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All files uploaded successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS - MANUAL EXECUTION REQUIRED" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  SSH into Vast.ai:" -ForegroundColor Yellow
Write-Host "  ssh -p $VAST_PORT ${VAST_USER}@${VAST_HOST}" -ForegroundColor White
Write-Host ""

Write-Host "2️⃣  Run cleanup script:" -ForegroundColor Yellow
Write-Host "  chmod +x vast-cleanup-sdxl-upgrade.sh" -ForegroundColor White
Write-Host "  ./vast-cleanup-sdxl-upgrade.sh" -ForegroundColor White
Write-Host ""
Write-Host "  ⚠️  Review disk usage and manually remove SD 1.5 models if needed:" -ForegroundColor Red
Write-Host "  rm -rf /root/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5" -ForegroundColor White
Write-Host ""

Write-Host "3️⃣  Run installation script (this will take 10-20 minutes):" -ForegroundColor Yellow
Write-Host "  chmod +x install-sdxl-packages.sh" -ForegroundColor White
Write-Host "  ./install-sdxl-packages.sh" -ForegroundColor White
Write-Host ""

Write-Host "4️⃣  Start the upgraded API (models will download automatically):" -ForegroundColor Yellow
Write-Host "  nohup python3 upgraded-sdxl-api.py > sdxl-api.log 2>&1 &" -ForegroundColor White
Write-Host "  tail -f sdxl-api.log" -ForegroundColor White
Write-Host ""

Write-Host "5️⃣  Wait for models to load (first run takes 10-15 minutes)" -ForegroundColor Yellow
Write-Host "  Watch for: 'All models loaded successfully!'" -ForegroundColor White
Write-Host ""

Write-Host "6️⃣  Test the API from your local machine:" -ForegroundColor Yellow
Write-Host "  node test-upgraded-sdxl-api.js" -ForegroundColor White
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "QUICK REFERENCE COMMANDS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Check disk space:" -ForegroundColor Yellow
Write-Host "  df -h /" -ForegroundColor White
Write-Host ""

Write-Host "Check API process:" -ForegroundColor Yellow
Write-Host "  ps aux | grep upgraded-sdxl-api" -ForegroundColor White
Write-Host ""

Write-Host "Check API logs:" -ForegroundColor Yellow
Write-Host "  tail -f /root/sdxl-api.log" -ForegroundColor White
Write-Host ""

Write-Host "Check GPU usage:" -ForegroundColor Yellow
Write-Host "  nvidia-smi" -ForegroundColor White
Write-Host ""

Write-Host "Kill API process:" -ForegroundColor Yellow
Write-Host "  pkill -f upgraded-sdxl-api.py" -ForegroundColor White
Write-Host ""

Write-Host "Test API health:" -ForegroundColor Yellow
Write-Host "  curl http://localhost:7860/health" -ForegroundColor White
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ESTIMATED TIME" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Cleanup: 5-10 minutes"
Write-Host "  Package installation: 10-20 minutes"
Write-Host "  Model download (first run): 10-15 minutes"
Write-Host "  Total: 25-45 minutes"
Write-Host ""

Write-Host "✨ Files are ready! Follow the steps above to complete the upgrade." -ForegroundColor Green
Write-Host ""

