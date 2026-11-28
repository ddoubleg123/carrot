# Simple script to test Render API and list services
# Since Render doesn't expose logs via API, this just shows available services

param(
    [string]$ApiKey = $env:RENDER_API_KEY
)

if (-not $ApiKey) {
    Write-Host "❌ API key not provided. Set RENDER_API_KEY environment variable or pass -ApiKey parameter" -ForegroundColor Red
    exit 1
}

$RENDER_API_BASE = "https://api.render.com/v1"

Write-Host ""
Write-Host "Testing Render API..." -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Accept" = "application/json"
}

try {
    # List services
    Write-Host "Fetching services..." -ForegroundColor Yellow
    $services = Invoke-RestMethod -Uri "$RENDER_API_BASE/services" -Method Get -Headers $headers
    
    Write-Host ""
    Write-Host "✓ Found $($services.Count) services:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($serviceItem in $services) {
        $service = $serviceItem.service
        $name = $service.name
        $id = $service.id
        $type = $service.type
        $status = $service.serviceDetails.status
        
        Write-Host "  Service: $name" -ForegroundColor White
        Write-Host "    ID: $id" -ForegroundColor Gray
        Write-Host "    Type: $type" -ForegroundColor Gray
        Write-Host "    Status: $status" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "⚠️  Note: Render API does not expose logs endpoint." -ForegroundColor Yellow
    Write-Host "   Use Render Dashboard or set up log streaming service." -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   Authentication failed. Check your API key." -ForegroundColor Yellow
    }
    exit 1
}
