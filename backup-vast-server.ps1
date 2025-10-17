# Backup Vast.ai Server Setup
# Run this to backup your current server before it's rented out

Write-Host "=== Vast.ai Server Backup Script ===" -ForegroundColor Cyan

$oldServer = "111.59.36.106"
$oldPort = "30400"
$backupDir = "vast-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "`nCreating backup directory: $backupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "`nBacking up API files from /root/..." -ForegroundColor Yellow
scp -P $oldPort root@${oldServer}:/root/generator_api.py "$backupDir/"
scp -P $oldPort root@${oldServer}:/root/prompt_styles.py "$backupDir/"
scp -P $oldPort root@${oldServer}:/root/prompt_builder.py "$backupDir/"
scp -P $oldPort root@${oldServer}:/root/firebase_utils.py "$backupDir/"
scp -P $oldPort root@${oldServer}:/root/enhancer_api.py "$backupDir/"
scp -P $oldPort root@${oldServer}:/root/.env "$backupDir/" 2>$null

Write-Host "`nBacking up requirements list..." -ForegroundColor Yellow
ssh -p $oldPort root@${oldServer} "pip list --format=freeze > /tmp/requirements.txt"
scp -P $oldPort root@${oldServer}:/tmp/requirements.txt "$backupDir/"

Write-Host "`nBackup complete! Files saved to: $backupDir" -ForegroundColor Green
Write-Host "`nTo restore to a new server, use: .\restore-vast-server.ps1 <new-ip> <new-port> $backupDir" -ForegroundColor Cyan

