#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start SSH tunnel to Vast.ai SDXL API

.DESCRIPTION
    This script starts an SSH tunnel from local port 7860 to Vast.ai's SDXL API.
    This allows the Carrot app to connect to the SDXL API running on Vast.ai.

.EXAMPLE
    .\start-vast-tunnel.ps1
#>

Write-Host "🚀 Starting SSH tunnel to Vast.ai SDXL API..." -ForegroundColor Green

# Check if port 7860 is already in use
$portInUse = Get-NetTCPConnection -LocalPort 7860 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  Port 7860 is already in use. Stopping existing connections..." -ForegroundColor Yellow
    
    # Kill any existing SSH connections on this port
    Get-Process | Where-Object {$_.ProcessName -eq "ssh"} | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force
            Write-Host "   Stopped SSH process: $($_.Id)" -ForegroundColor Gray
        } catch {
            Write-Host "   Could not stop SSH process: $($_.Id)" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 2
}

# Start the SSH tunnel
Write-Host "🔗 Creating SSH tunnel: localhost:7860 → vast.ai:7860" -ForegroundColor Cyan

try {
    # Start SSH tunnel in background
    $sshProcess = Start-Process -FilePath "ssh" -ArgumentList @(
        "-f", "-N", 
        "-L", "7860:localhost:7860", 
        "-p", "45583", 
        "root@171.247.185.4"
    ) -PassThru -WindowStyle Hidden
    
    Start-Sleep -Seconds 3
    
    # Test if the tunnel is working
    Write-Host "🧪 Testing tunnel connection..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:7860/health" -TimeoutSec 10 -UseBasicParsing
        $healthData = $response.Content | ConvertFrom-Json
        
        Write-Host "✅ SSH tunnel is working!" -ForegroundColor Green
        Write-Host "   SDXL API Status: $($healthData.status)" -ForegroundColor Gray
        Write-Host "   Models Loaded: $($healthData.model_loaded)" -ForegroundColor Gray
        Write-Host "   CUDA Available: $($healthData.cuda_available)" -ForegroundColor Gray
        
        if ($healthData.model_loaded) {
            Write-Host "🎉 Ready to generate images!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Models are still loading. Wait a few minutes and test again." -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "❌ Tunnel created but API not responding. Check Vast.ai instance status." -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    }
    
    Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Go to: http://localhost:3005/test-deepseek-images" -ForegroundColor White
    Write-Host "   2. Try generating an image" -ForegroundColor White
    Write-Host "   3. If issues, run: .\start-vast-tunnel.ps1" -ForegroundColor White
    
    Write-Host "`n🔧 To stop the tunnel:" -ForegroundColor Yellow
    Write-Host "   Get-Process | Where-Object {`$_.ProcessName -eq 'ssh'} | Stop-Process -Force" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Failed to start SSH tunnel" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "`n💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Make sure SSH is installed (Windows 10+ includes OpenSSH)" -ForegroundColor White
    Write-Host "   2. Check if Vast.ai instance is running" -ForegroundColor White
    Write-Host "   3. Verify the IP address and port in the script" -ForegroundColor White
    Write-Host "   4. Try running: ssh -p 45583 root@171.247.185.4" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')