Write-Host "Testing Vast.ai API directly..." -ForegroundColor Cyan

# Test 1: Basic API health check
try {
    $response = Invoke-WebRequest -Uri "http://83.10.113.244:7860/" -TimeoutSec 10
    Write-Host "✅ API Health Check: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "❌ API Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting image generation..." -ForegroundColor Cyan

# Test 2: Image generation
$body = @{
    prompt = "basketball player"
    steps = 20
    width = 1280
    height = 720
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://83.10.113.244:7860/sdapi/v1/txt2img" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "✅ Image Generation: $($response.StatusCode)" -ForegroundColor Green
    
    $data = $response.Content | ConvertFrom-Json
    if ($data.images -and $data.images.Count -gt 0) {
        Write-Host "✅ Generated image (base64 length: $($data.images[0].Length))" -ForegroundColor Green
    } else {
        Write-Host "⚠️ No images in response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Image Generation Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full error: $($_.Exception)" -ForegroundColor Red
}

Write-Host "`nTest complete!" -ForegroundColor Cyan
