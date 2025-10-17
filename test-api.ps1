$body = @{
    prompt = "basketball player"
    steps = 20
    width = 1280
    height = 720
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://83.10.113.244:7860/sdapi/v1/txt2img" -Method POST -Body $body -ContentType "application/json"
    Write-Host "SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
