# Start SSH Tunnel for Second Server (SDXL)
Write-Host "🚀 Starting SSH tunnel for Second Server (SDXL)" -ForegroundColor Green

# Kill any existing tunnels on port 7861
Write-Host "🧹 Cleaning up existing tunnels..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 7861 -ErrorAction SilentlyContinue | ForEach-Object {
    $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "ssh") {
        Stop-Process -Id $process.Id -Force
        Write-Host "   Stopped existing tunnel on port 7861" -ForegroundColor Gray
    }
}

# Start SSH tunnel for second server
Write-Host "🔗 Creating SSH tunnel for Second Server..." -ForegroundColor Yellow
Write-Host "   Local: http://localhost:7861" -ForegroundColor White
Write-Host "   Remote: http://localhost:7860 (SDXL API)" -ForegroundColor White
Write-Host ""

$tunnel = Start-Process -FilePath "ssh" -ArgumentList "-p", "30400", "root@111.59.36.106", "-L", "7861:localhost:7860", "-N" -PassThru -WindowStyle Hidden

Start-Sleep 3

# Test the connection
Write-Host "🧪 Testing SDXL API connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7861/health" -TimeoutSec 10 -UseBasicParsing
    $healthData = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ SUCCESS! SDXL API is accessible!" -ForegroundColor Green
    Write-Host "   Status: $($healthData.status)" -ForegroundColor White
    Write-Host "   Models Loaded: $($healthData.models_loaded)" -ForegroundColor White
    Write-Host "   GPU: $($healthData.gpu_info.gpu_name)" -ForegroundColor White
    Write-Host "   VRAM: $($healthData.gpu_info.allocated_memory_gb)GB / $($healthData.gpu_info.total_memory_gb)GB" -ForegroundColor White
    
    # Update environment for the app
    Write-Host ""
    Write-Host "🔧 Updating app environment..." -ForegroundColor Yellow
    Set-Content -Path "carrot\.env.local" -Value "VAST_AI_URL=http://localhost:7861"
    Write-Host "✅ Updated .env.local to use Second Server (SDXL)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "🔄 Trying alternative connection..." -ForegroundColor Yellow
    
    # Try proxy connection
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep 2
    
    $tunnel = Start-Process -FilePath "ssh" -ArgumentList "-p", "28963", "root@ssh1.vast.ai", "-L", "7861:localhost:7860", "-N" -PassThru -WindowStyle Hidden
    Start-Sleep 3
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:7861/health" -TimeoutSec 10 -UseBasicParsing
        Write-Host "✅ SUCCESS! SDXL API accessible via proxy!" -ForegroundColor Green
        Set-Content -Path "carrot\.env.local" -Value "VAST_AI_URL=http://localhost:7861"
    } catch {
        Write-Host "❌ Both connections failed" -ForegroundColor Red
        Write-Host "Please check if the SDXL API is running on the server" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎯 Ready to test at: http://localhost:3005/test-deepseek-images" -ForegroundColor Cyan
Write-Host "🛑 Press Ctrl+C to stop this script and tunnel" -ForegroundColor Yellow

# Keep script running
try {
    while ($true) {
        Start-Sleep 10
        if ($tunnel.HasExited) {
            Write-Host "⚠️  SSH tunnel disconnected, restarting..." -ForegroundColor Yellow
            $tunnel = Start-Process -FilePath "ssh" -ArgumentList "-p", "30400", "root@111.59.36.106", "-L", "7861:localhost:7860", "-N" -PassThru -WindowStyle Hidden
        }
    }
} catch {
    Write-Host "🛑 Stopping tunnel..." -ForegroundColor Red
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
}
