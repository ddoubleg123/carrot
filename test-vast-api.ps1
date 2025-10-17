try {
    $response = Invoke-WebRequest -Uri "http://83.10.113.244:7860/sdapi/v1/sd-models" -TimeoutSec 5 -UseBasicParsing
    Write-Output "✅ Status: $($response.StatusCode) - API is running!"
    Write-Output "Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))"
} catch {
    Write-Output "❌ API not accessible: $($_.Exception.Message)"
}

