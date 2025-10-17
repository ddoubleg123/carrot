# Vast.ai Connection Script
Write-Host "🚀 Setting up Vast.ai AI Image Generation..." -ForegroundColor Cyan

# Kill any existing processes
Get-Process -Name ssh -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*7860*" -or $_.CommandLine -like "*8080*" } | Stop-Process -Force

# Start SSH tunnel in background
Write-Host "🔗 Creating SSH tunnel..." -ForegroundColor Yellow
$tunnel = Start-Process -FilePath "ssh" -ArgumentList "-L", "7860:localhost:8080", "-p", "44302", "root@83.10.113.244", "-N" -PassThru -WindowStyle Hidden

Start-Sleep 5

# Test the connection
Write-Host "🧪 Testing connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7860/" -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ SUCCESS! Vast.ai API is accessible!" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
    
    # Update environment
    Set-Content -Path "carrot\.env.local" -Value "VAST_AI_URL=http://localhost:7860"
    Write-Host "🔧 Updated environment to use Vast.ai API" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "🔄 Falling back to Wikimedia Commons..." -ForegroundColor Yellow
    Set-Content -Path "carrot\.env.local" -Value "VAST_AI_URL=http://localhost:3000/api/test-vast-api"
}

Write-Host "🎯 Ready to test at: http://localhost:3005/test-deepseek-images" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop this script" -ForegroundColor Yellow

# Keep script running
try {
    while ($true) {
        Start-Sleep 10
        if ($tunnel.HasExited) {
            Write-Host "⚠️  SSH tunnel disconnected, restarting..." -ForegroundColor Yellow
            $tunnel = Start-Process -FilePath "ssh" -ArgumentList "-L", "7860:localhost:8080", "-p", "44302", "root@83.10.113.244", "-N" -PassThru -WindowStyle Hidden
        }
    }
} catch {
    Write-Host "🛑 Stopping tunnel..." -ForegroundColor Red
    $tunnel.Kill()
}
