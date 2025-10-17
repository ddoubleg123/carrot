$server = "root@46.217.24.207"
$port = "40112"

Write-Host "Creating /root/sdxl-api directory..."
ssh -p $port $server "mkdir -p /root/sdxl-api"

Write-Host "Uploading all files..."
scp -P $port vast-backup-20251015-115024/*.py "${server}:/root/sdxl-api/"
scp -P $port vast-backup-20251015-115024/requirements.txt "${server}:/root/sdxl-api/"
scp -P $port vast-backup-20251015-115024/vast-server.env "${server}:/root/sdxl-api/.env"

Write-Host "Done! Files uploaded to server."

