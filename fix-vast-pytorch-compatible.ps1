# Fix Vast.ai PyTorch Compatibility Issue
# Downloads compatible PyTorch versions using wget (resumable)

param(
    [string]$VastSSH = "ssh://root@ssh4.vast.ai:14688"
)

Write-Host "🚀 Fixing Vast.ai PyTorch Compatibility..." -ForegroundColor Green
Write-Host ""

# Extract SSH details
if ($VastSSH -match "root@(.+):(\d+)") {
    $VastHost = $matches[1]
    $VastPort = $matches[2]
} else {
    Write-Host "❌ Invalid SSH format. Expected: ssh://root@host:port" -ForegroundColor Red
    Write-Host "Example: ssh://root@ssh4.vast.ai:14688" -ForegroundColor Yellow
    exit 1
}

Write-Host "📡 Target: $VastHost : $VastPort" -ForegroundColor Cyan
Write-Host ""

# Step 1: Upload PyTorch setup script
Write-Host "📦 Step 1/5: Uploading PyTorch downgrade script..." -ForegroundColor Yellow
scp -P $VastPort setup-sdxl-compatible-pytorch.sh root@${VastHost}:/root/
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload PyTorch script" -ForegroundColor Red
    exit 1
}
Write-Host "✅ PyTorch script uploaded" -ForegroundColor Green
Write-Host ""

# Step 2: Upload full setup script
Write-Host "📦 Step 2/5: Uploading full setup script..." -ForegroundColor Yellow
scp -P $VastPort setup-sdxl-full-compatible.sh root@${VastHost}:/root/
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload full setup script" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Full setup script uploaded" -ForegroundColor Green
Write-Host ""

# Step 3: Upload API script
Write-Host "📦 Step 3/5: Uploading upgraded-sdxl-api.py..." -ForegroundColor Yellow
scp -P $VastPort upgraded-sdxl-api.py root@${VastHost}:/root/
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload API script" -ForegroundColor Red
    exit 1
}
Write-Host "✅ API script uploaded" -ForegroundColor Green
Write-Host ""

# Step 4: Run PyTorch downgrade (resumable!)
Write-Host "📦 Step 4/5: Downgrading PyTorch (this may take 15-20 minutes)..." -ForegroundColor Yellow
Write-Host "   Downloading 2.3GB torch wheel + 700MB torchvision wheel" -ForegroundColor Cyan
Write-Host "   ℹ️  If interrupted, just re-run - wget will resume!" -ForegroundColor Cyan
Write-Host ""

$pytorchCommand = @"
cd /root && \
chmod +x setup-sdxl-compatible-pytorch.sh && \
bash setup-sdxl-compatible-pytorch.sh
"@

ssh -p $VastPort root@$VastHost $pytorchCommand
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ PyTorch downgrade failed or was interrupted" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 If download was interrupted, just re-run this script:" -ForegroundColor Yellow
    Write-Host "   .\fix-vast-pytorch-compatible.ps1 -VastSSH `"$VastSSH`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   wget will resume from where it left off!" -ForegroundColor Cyan
    exit 1
}
Write-Host ""
Write-Host "✅ PyTorch downgraded successfully" -ForegroundColor Green
Write-Host ""

# Step 5: Run full setup
Write-Host "📦 Step 5/5: Installing SDXL + CodeFormer + RealESRGAN..." -ForegroundColor Yellow
Write-Host "   This will take 5-10 minutes" -ForegroundColor Cyan
Write-Host ""

$fullSetupCommand = @"
cd /root && \
chmod +x setup-sdxl-full-compatible.sh && \
bash setup-sdxl-full-compatible.sh
"@

ssh -p $VastPort root@$VastHost $fullSetupCommand
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Full setup failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next step - Start the API:" -ForegroundColor Yellow
Write-Host "   ssh -p $VastPort root@$VastHost" -ForegroundColor Cyan
Write-Host "   cd /root && python3 upgraded-sdxl-api.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Or use: .\start-vast-upgraded-api.ps1 -VastSSH `"$VastSSH`"" -ForegroundColor Cyan
Write-Host ""

