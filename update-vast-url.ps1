# Update VAST_AI_URL in carrot/.env.local
$envFile = "carrot\.env.local"

if (Test-Path $envFile) {
    $content = Get-Content $envFile
    $newContent = $content -replace 'VAST_AI_URL=http://localhost:7861', 'VAST_AI_URL=http://localhost:30400'
    $newContent | Set-Content $envFile
    Write-Host "Updated VAST_AI_URL to http://localhost:30400"
    Write-Host ""
    Write-Host "Remember to start SSH tunnel:"
    Write-Host "ssh -p 30400 root@111.59.36.106 -L 30400:localhost:30400"
} else {
    Write-Host "File not found: $envFile"
}