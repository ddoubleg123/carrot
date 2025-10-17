# PowerShell script to upload SDXL deployment files to Vast.ai
# Usage: .\upload-sdxl-files.ps1

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "🚀 SDXL Files Upload Script" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Vast.ai connection details
$VAST_PORT = "45583"
$VAST_IP = "171.247.185.4"
$VAST_USER = "root"
$VAST_HOST = "${VAST_USER}@${VAST_IP}"

Write-Host "📋 Target: ${VAST_HOST}:${VAST_PORT}" -ForegroundColor Yellow
Write-Host ""

# Check if files exist
$files = @(
    "upgraded-sdxl-api.py",
    "deploy-sdxl.sh",
    "verify-sdxl.sh",
    "rollback-sdxl.sh"
)

$missing = @()
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Missing files. Cannot proceed." -ForegroundColor Red
    Write-Host "   Make sure you're in the project root directory." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "📤 Uploading files to Vast.ai..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Upload all files
$filesString = $files -join " "
$scpCommand = "scp -P $VAST_PORT $filesString ${VAST_HOST}:/root/"

Write-Host "Running: $scpCommand" -ForegroundColor Gray
Write-Host ""

try {
    & scp -P $VAST_PORT $files "${VAST_HOST}:/root/"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Green
        Write-Host "✅ Upload Complete!" -ForegroundColor Green
        Write-Host "================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Next Steps:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   1. SSH into Vast.ai:" -ForegroundColor White
        Write-Host "      ssh -p $VAST_PORT $VAST_HOST" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   2. Make scripts executable:" -ForegroundColor White
        Write-Host "      chmod +x /root/*.sh" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   3. Run deployment:" -ForegroundColor White
        Write-Host "      ./deploy-sdxl.sh" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   4. After models download, verify:" -ForegroundColor White
        Write-Host "      ./verify-sdxl.sh" -ForegroundColor Gray
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📖 Full guide: SDXL-MIGRATION-GUIDE.md" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Upload failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
        Write-Host "   - Check if Vast.ai instance is running" -ForegroundColor White
        Write-Host "   - Verify SSH connection: ssh -p $VAST_PORT $VAST_HOST" -ForegroundColor White
        Write-Host "   - Check port number in Vast.ai dashboard" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

