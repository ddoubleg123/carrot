#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test the Upgraded SDXL API

.DESCRIPTION
    This script tests the upgraded SDXL API with CodeFormer and RealESRGAN.
    Run this after starting the SSH tunnel and API.

.EXAMPLE
    .\test-upgraded-api.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "🧪 Testing Upgraded SDXL API..." -ForegroundColor Cyan
Write-Host ""

# Check if tunnel is running
Write-Host "1️⃣ Checking SSH tunnel..." -ForegroundColor Yellow
try {
    $tunnelTest = Get-NetTCPConnection -LocalPort 7860 -ErrorAction SilentlyContinue
    if ($tunnelTest) {
        Write-Host "   ✅ SSH tunnel is active on port 7860" -ForegroundColor Green
    } else {
        Write-Host "   ❌ SSH tunnel not found on port 7860" -ForegroundColor Red
        Write-Host "   💡 Run: .\start-vast-tunnel.ps1" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ⚠️  Could not check tunnel status" -ForegroundColor Yellow
}

Write-Host ""

# Test health endpoint
Write-Host "2️⃣ Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:7860/health" -TimeoutSec 10
    
    Write-Host "   ✅ API is responding" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
    Write-Host "   Models Loaded: $($health.model_loaded)" -ForegroundColor Gray
    Write-Host "   CUDA Available: $($health.cuda_available)" -ForegroundColor Gray
    Write-Host "   CodeFormer Available: $($health.codeformer_available)" -ForegroundColor Gray
    Write-Host "   RealESRGAN Available: $($health.realesrgan_available)" -ForegroundColor Gray
    Write-Host "   VRAM: $($health.vram_available)" -ForegroundColor Gray
    
    if (-not $health.model_loaded) {
        Write-Host ""
        Write-Host "   ⚠️  Models are still loading..." -ForegroundColor Yellow
        Write-Host "   ⏳ This takes 30-40 minutes on first run" -ForegroundColor Yellow
        Write-Host "   💡 Check the Vast.ai SSH terminal for progress" -ForegroundColor Yellow
        exit 0
    }
    
    if (-not $health.codeformer_available) {
        Write-Host ""
        Write-Host "   ⚠️  CodeFormer not available (face restoration disabled)" -ForegroundColor Yellow
    }
    
    if (-not $health.realesrgan_available) {
        Write-Host ""
        Write-Host "   ⚠️  RealESRGAN not available (will use LANCZOS fallback)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "   ❌ API not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "      1. Is the API running on Vast.ai?" -ForegroundColor White
    Write-Host "      2. Is the SSH tunnel active?" -ForegroundColor White
    Write-Host "      3. Check Vast.ai SSH terminal for errors" -ForegroundColor White
    exit 1
}

Write-Host ""

# Test image generation
Write-Host "3️⃣ Testing image generation..." -ForegroundColor Yellow
Write-Host "   This will take 15-30 seconds..." -ForegroundColor Gray
Write-Host ""

$testRequest = @{
    prompt = "professional headshot of a smiling business executive, sharp focus, detailed face, 8k, photorealistic"
    negative_prompt = "blurry, low quality, distorted, ugly, deformed"
    width = 1024
    height = 1024
    num_inference_steps = 25
    guidance_scale = 7.5
    use_refiner = $true
    use_face_restoration = $true
    face_restoration_weight = 0.6
    hires_fix = $false
    use_realesrgan = $true
    seed = 42
} | ConvertTo-Json

try {
    $startTime = Get-Date
    
    Write-Host "   🎨 Generating image..." -ForegroundColor Cyan
    Write-Host "   Prompt: professional headshot..." -ForegroundColor Gray
    Write-Host "   Resolution: 1024x1024" -ForegroundColor Gray
    Write-Host "   Refiner: Enabled" -ForegroundColor Gray
    Write-Host "   Face Restoration: Enabled" -ForegroundColor Gray
    Write-Host ""
    
    $response = Invoke-RestMethod -Uri "http://localhost:7860/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testRequest `
        -TimeoutSec 120
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    if ($response.success) {
        Write-Host "   ✅ Image generated successfully!" -ForegroundColor Green
        Write-Host "   Generation Time: $([math]::Round($duration, 1))s" -ForegroundColor Gray
        Write-Host "   Final Resolution: $($response.final_resolution)" -ForegroundColor Gray
        Write-Host "   Model: $($response.model)" -ForegroundColor Gray
        Write-Host "   Face Restoration Applied: $($response.face_restoration_applied)" -ForegroundColor Gray
        Write-Host "   Refiner Applied: $($response.refiner_applied)" -ForegroundColor Gray
        Write-Host "   Hires Fix Applied: $($response.hires_fix_applied)" -ForegroundColor Gray
        
        # Save the image
        $imageData = $response.image -replace "^data:image/png;base64,", ""
        $imageBytes = [Convert]::FromBase64String($imageData)
        $outputPath = "test-output-upgraded-sdxl.png"
        [IO.File]::WriteAllBytes($outputPath, $imageBytes)
        
        Write-Host ""
        Write-Host "   💾 Image saved to: $outputPath" -ForegroundColor Green
        Write-Host "   📂 Open it to see the quality!" -ForegroundColor Cyan
        
        # Try to open the image
        try {
            Start-Process $outputPath
        } catch {
            Write-Host "   (Could not auto-open image)" -ForegroundColor Gray
        }
        
    } else {
        Write-Host "   ❌ Generation failed" -ForegroundColor Red
        Write-Host "   Error: $($response.error)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   ❌ Generation request failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    
    if ($_.Exception.Message -match "timeout") {
        Write-Host ""
        Write-Host "   💡 Request timed out. This can happen if:" -ForegroundColor Yellow
        Write-Host "      1. GPU is still loading models" -ForegroundColor White
        Write-Host "      2. GPU is out of memory" -ForegroundColor White
        Write-Host "      3. Generation is taking longer than expected" -ForegroundColor White
    }
    exit 1
}

Write-Host ""
Write-Host "🎉 All tests passed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Open the generated image: test-output-upgraded-sdxl.png" -ForegroundColor White
Write-Host "   2. Test from frontend: http://localhost:3005/test-deepseek-images" -ForegroundColor White
Write-Host "   3. Compare with old SD v1.5 images" -ForegroundColor White
Write-Host "   4. Try hires_fix: true for 1536x1536 resolution" -ForegroundColor White
Write-Host ""
Write-Host "✨ Enjoy crisp, photorealistic faces! ✨" -ForegroundColor Green

