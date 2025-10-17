# Restore Vast.ai Server from Backup
# Usage: .\restore-vast-server.ps1 <new-ip> <new-port> <backup-dir>

param(
    [Parameter(Mandatory=$true)]
    [string]$newServer,
    
    [Parameter(Mandatory=$true)]
    [string]$newPort,
    
    [Parameter(Mandatory=$true)]
    [string]$backupDir
)

Write-Host "=== Vast.ai Server Restore Script ===" -ForegroundColor Cyan
Write-Host "Target: $newServer:$newPort" -ForegroundColor Yellow
Write-Host "Backup: $backupDir" -ForegroundColor Yellow

# Upload all Python files
Write-Host "`nUploading API files..." -ForegroundColor Yellow
scp -P $newPort "$backupDir/generator_api.py" root@${newServer}:/root/
scp -P $newPort "$backupDir/prompt_styles.py" root@${newServer}:/root/
scp -P $newPort "$backupDir/prompt_builder.py" root@${newServer}:/root/
scp -P $newPort "$backupDir/firebase_utils.py" root@${newServer}:/root/
scp -P $newPort "$backupDir/enhancer_api.py" root@${newServer}:/root/
scp -P $newPort "$backupDir/.env" root@${newServer}:/root/ 2>$null

# Install packages
Write-Host "`nInstalling Python packages..." -ForegroundColor Yellow
ssh -p $newPort root@${newServer} @"
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate safetensors pillow fastapi uvicorn python-dotenv pydantic
pip install firebase-admin google-cloud-storage
"@

Write-Host "`nStarting Generator API on port 30401..." -ForegroundColor Yellow
ssh -p $newPort root@${newServer} "cd /root && nohup python3 -m uvicorn generator_api:app --host 0.0.0.0 --port 30401 --log-level debug > /tmp/generator.log 2>&1 &"

Write-Host "`n✅ Restore complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Update your local SSH tunnel: ssh -p $newPort root@$newServer -L 30401:localhost:30401 -N" -ForegroundColor White
Write-Host "2. Test health: curl http://localhost:30401/health" -ForegroundColor White

