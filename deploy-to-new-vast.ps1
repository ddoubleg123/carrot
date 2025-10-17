$server = "root@46.217.24.207"
$port = "40112"
$backupDir = "vast-backup-20251015-115024"

Write-Host "=== Deploying to New Vast.ai Server ==="
Write-Host "Server: $server"
Write-Host "Port: $port"
Write-Host ""

# Create directory
Write-Host "1. Creating directory..."
ssh -p $port $server "mkdir -p /root/sdxl-api"

# Upload generator_api.py
Write-Host "2. Uploading generator_api.py..."
scp -P $port "$backupDir/generator_api.py" "${server}:/root/sdxl-api/"

# Upload enhancer_api.py
Write-Host "3. Uploading enhancer_api.py..."
scp -P $port "$backupDir/enhancer_api.py" "${server}:/root/sdxl-api/"

# Upload prompt_styles.py
Write-Host "4. Uploading prompt_styles.py..."
scp -P $port "$backupDir/prompt_styles.py" "${server}:/root/sdxl-api/"

# Upload prompt_builder.py
Write-Host "5. Uploading prompt_builder.py..."
scp -P $port "$backupDir/prompt_builder.py" "${server}:/root/sdxl-api/"

# Upload firebase_utils.py
Write-Host "6. Uploading firebase_utils.py..."
scp -P $port "$backupDir/firebase_utils.py" "${server}:/root/sdxl-api/"

# Upload requirements.txt
Write-Host "7. Uploading requirements.txt..."
scp -P $port "$backupDir/requirements.txt" "${server}:/root/sdxl-api/"

# Upload .env
Write-Host "8. Uploading .env..."
scp -P $port "$backupDir/vast-server.env" "${server}:/root/sdxl-api/.env"

Write-Host ""
Write-Host "=== Deployment Complete ==="
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. SSH into server: ssh -p $port $server"
Write-Host "2. Install dependencies: cd /root/sdxl-api && pip install -r requirements.txt"
Write-Host "3. Start Generator API: uvicorn generator_api:app --host 0.0.0.0 --port 30400"
Write-Host "4. Start Enhancer API: uvicorn enhancer_api:app --host 0.0.0.0 --port 30500"

