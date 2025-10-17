#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test connection to Vast.ai SDXL API

.DESCRIPTION
    This script tests the connection to the SDXL API running on Vast.ai
    through the SSH tunnel.
#>

Write-Host "🧪 Testing Vast.ai SDXL API Connection..." -ForegroundColor Green

# Test 1: Basic connectivity
Write-Host "`n1️⃣ Testing basic connectivity..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:7860/health" -TimeoutSec 10
    
    Write-Host "✅ Connection successful!" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.status)" -ForegroundColor Gray
    Write-Host "   Models Loaded: $($healthResponse.model_loaded)" -ForegroundColor Gray
    Write-Host "   CUDA Available: $($healthResponse.cuda_available)" -ForegroundColor Gray
    Write-Host "   CodeFormer: $($healthResponse.codeformer_available)" -ForegroundColor Gray
    Write-Host "   RealESRGAN: $($healthResponse.realesrgan_available)" -ForegroundColor Gray
    Write-Host "   VRAM: $($healthResponse.vram_available)" -ForegroundColor Gray
    
    if (-not $healthResponse.model_loaded) {
        Write-Host "⚠️  Models are still loading. Wait a few minutes." -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "❌ Connection failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "`n💡 Try running: .\start-vast-tunnel.ps1" -ForegroundColor Yellow
    exit 1
}

# Test 2: Simple image generation
Write-Host "`n2️⃣ Testing image generation..." -ForegroundColor Cyan
try {
    $body = @{
        prompt = "simple red apple, test image"
        num_inference_steps = 15
        width = 512
        height = 512
        use_refiner = $false
    } | ConvertTo-Json
    
    Write-Host "   Generating test image..." -ForegroundColor Gray
    
    $startTime = Get-Date
    $genResponse = Invoke-RestMethod -Uri "http://localhost:7860/generate" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    if ($genResponse.success -and $genResponse.image) {
        Write-Host "✅ Image generation successful!" -ForegroundColor Green
        Write-Host "   Time: $($duration.ToString('F1')) seconds" -ForegroundColor Gray
        Write-Host "   Resolution: $($genResponse.final_resolution)" -ForegroundColor Gray
        Write-Host "   Image size: $($genResponse.image.Length) characters" -ForegroundColor Gray
        
        # Save test image
        $imageData = [System.Convert]::FromBase64String($genResponse.image.Split(',')[1])
        $imagePath = "test-image-$(Get-Date -Format 'yyyyMMdd-HHmmss').png"
        [System.IO.File]::WriteAllBytes($imagePath, $imageData)
        Write-Host "   Saved test image: $imagePath" -ForegroundColor Gray
        
    } else {
        Write-Host "❌ Image generation failed!" -ForegroundColor Red
        Write-Host "   Response: $($genResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Image generation test failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "   Check Vast.ai logs for more details" -ForegroundColor Gray
}

Write-Host "`n🎉 Connection test complete!" -ForegroundColor Green
Write-Host "   Your SDXL API is ready to use!" -ForegroundColor White

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
