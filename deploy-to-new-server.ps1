# Deploy to New Vast.ai Server
# Update these variables with the correct connection details

$newServer = "207.102.87.207"  # Update with correct IP
$newPort = "50443"             # Update with correct port
$backupDir = "vast-backup-20251015-115024"

Write-Host "=== Deploying to New Vast.ai Server ===" -ForegroundColor Cyan
Write-Host "Target: $newServer:$newPort" -ForegroundColor Yellow

# Test connection first
Write-Host "`nTesting connection..." -ForegroundColor Yellow
ssh -p $newPort root@${newServer} "echo 'Connection successful'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connection successful!" -ForegroundColor Green
    
    # Upload all Python files
    Write-Host "`nUploading API files..." -ForegroundColor Yellow
    scp -P $newPort "$backupDir/generator_api.py" root@${newServer}:/root/
    scp -P $newPort "$backupDir/prompt_styles.py" root@${newServer}:/root/
    scp -P $newPort "$backupDir/prompt_builder.py" root@${newServer}:/root/
    scp -P $newPort "$backupDir/firebase_utils.py" root@${newServer}:/root/
    scp -P $newPort "$backupDir/enhancer_api.py" root@${newServer}:/root/
    scp -P $newPort "$backupDir/.env" root@${newServer}:/root/
    
    # Install packages
    Write-Host "`nInstalling Python packages..." -ForegroundColor Yellow
    ssh -p $newPort root@${newServer} @"
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate safetensors pillow fastapi uvicorn python-dotenv pydantic
pip install firebase-admin google-cloud-storage
"@
    
    # Start the API
    Write-Host "`nStarting Generator API..." -ForegroundColor Yellow
    ssh -p $newPort root@${newServer} "cd /root && nohup python3 -m uvicorn generator_api:app --host 0.0.0.0 --port 30401 --log-level debug > /tmp/generator.log 2>&1 &"
    
    Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Update SSH tunnel: ssh -p $newPort root@$newServer -L 30401:localhost:30401 -N" -ForegroundColor White
    Write-Host "2. Test health: curl http://localhost:30401/health" -ForegroundColor White
    
} else {
    Write-Host "❌ Connection failed!" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Server is running in Vast.ai dashboard" -ForegroundColor White
    Write-Host "2. IP and port are correct" -ForegroundColor White
    Write-Host "3. Server is not in 'Scheduling' status" -ForegroundColor White
}
