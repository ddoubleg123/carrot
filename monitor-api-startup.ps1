#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Monitor SDXL API startup progress

.DESCRIPTION
    Checks the API health endpoint every 30 seconds until models are loaded

.EXAMPLE
    .\monitor-api-startup.ps1
#>

Write-Host "🔍 Monitoring SDXL API Startup..." -ForegroundColor Cyan
Write-Host "   Checking http://localhost:7860/health every 30 seconds" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop monitoring" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
$checkCount = 0

while ($true) {
    $checkCount++
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
    
    Write-Host "[$checkCount] Check at $elapsed minutes..." -ForegroundColor Yellow
    
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:7860/health" -TimeoutSec 5 -ErrorAction Stop
        
        if ($health.model_loaded) {
            Write-Host ""
            Write-Host "🎉 API IS READY!" -ForegroundColor Green
            Write-Host ""
            Write-Host "   Status: $($health.status)" -ForegroundColor Green
            Write-Host "   Models Loaded: ✅" -ForegroundColor Green
            Write-Host "   CodeFormer: $($health.codeformer_available)" -ForegroundColor $(if($health.codeformer_available){'Green'}else{'Yellow'})
            Write-Host "   RealESRGAN: $($health.realesrgan_available)" -ForegroundColor $(if($health.realesrgan_available){'Green'}else{'Yellow'})
            Write-Host "   VRAM: $($health.vram_available)" -ForegroundColor Gray
            Write-Host ""
            Write-Host "✨ You can now generate images!" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "🧪 Test with: .\test-upgraded-api.ps1" -ForegroundColor White
            Write-Host "🌐 Or visit: http://localhost:3005/test-deepseek-images" -ForegroundColor White
            Write-Host ""
            break
        } else {
            Write-Host "   ⏳ API responding but models still loading..." -ForegroundColor Yellow
            Write-Host "   Status: $($health.status)" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "   ⏳ API not responding yet (still downloading models)..." -ForegroundColor Yellow
        
        if ($elapsed -gt 5) {
            $remaining = [math]::Max(0, 40 - $elapsed)
            Write-Host "   Estimated time remaining: ~$([math]::Round($remaining, 0)) minutes" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Start-Sleep -Seconds 30
}

Write-Host "🎊 Total startup time: $elapsed minutes" -ForegroundColor Green

