# Simple SSH Tunnel for Second Server
Write-Host "🚀 Starting simple SSH tunnel for SDXL server" -ForegroundColor Green

# Kill any existing tunnels
Get-NetTCPConnection -LocalPort 7861 -ErrorAction SilentlyContinue | ForEach-Object {
    $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "ssh") {
        Stop-Process -Id $process.Id -Force
        Write-Host "Stopped existing tunnel" -ForegroundColor Yellow
    }
}

Write-Host "Creating tunnel: localhost:7861 -> server:7860" -ForegroundColor Yellow

# Start tunnel
Start-Process -FilePath "ssh" -ArgumentList "-p", "30400", "root@111.59.36.106", "-L", "7861:localhost:7860", "-N" -WindowStyle Hidden

Start-Sleep 5

Write-Host "Testing connection..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:7861/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ SUCCESS! SDXL API is accessible at http://localhost:7861" -ForegroundColor Green
} catch {
    Write-Host "❌ Connection failed. Trying proxy..." -ForegroundColor Red
    
    # Try proxy
    Start-Process -FilePath "ssh" -ArgumentList "-p", "28963", "root@ssh1.vast.ai", "-L", "7861:localhost:7860", "-N" -WindowStyle Hidden
    Start-Sleep 5
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:7861/health" -TimeoutSec 10 -UseBasicParsing
        Write-Host "✅ SUCCESS! SDXL API accessible via proxy" -ForegroundColor Green
    } catch {
        Write-Host "❌ Both connections failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Test your app at: http://localhost:3005/test-deepseek-images" -ForegroundColor Cyan
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
