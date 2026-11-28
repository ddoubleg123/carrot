# PowerShell script to fetch Render logs using Render API
# Usage: .\fetch-render-logs-api.ps1 -ApiKey <your-api-key> [options]

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    
    [string]$ServiceId = "",
    [string]$ServiceName = "carrot-app",
    [int]$Limit = 1000,
    [string]$OutputFile = "",
    [string]$Filter = "",
    [string]$Since = ""
)

# Render API base URL
$RENDER_API_BASE = "https://api.render.com/v1"

# Function to get service ID from name
function Get-ServiceId {
    param([string]$Name, [string]$ApiKey)
    
    Write-Host "Looking up service ID for: $Name" -ForegroundColor Cyan
    
    try {
        $headers = @{
            "Authorization" = "Bearer $ApiKey"
            "Accept" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$RENDER_API_BASE/services" -Method Get -Headers $headers -ErrorAction Stop
        
        $service = $response | Where-Object { $_.service.name -eq $Name -or $_.service.serviceDetails.name -eq $Name }
        
        if ($service) {
            $serviceId = $service.service.id -or $service.service.serviceDetails.id
            Write-Host "✓ Found service ID: $serviceId" -ForegroundColor Green
            return $serviceId
        } else {
            Write-Host "❌ Service '$Name' not found" -ForegroundColor Red
            Write-Host "Available services:" -ForegroundColor Yellow
            $response | ForEach-Object { 
                $name = $_.service.name -or $_.service.serviceDetails.name
                $id = $_.service.id -or $_.service.serviceDetails.id
                Write-Host "  - $name ($id)" -ForegroundColor Gray
            }
            return $null
        }
    } catch {
        Write-Host "❌ Error fetching services: $_" -ForegroundColor Red
        return $null
    }
}

# Function to fetch logs
function Get-RenderLogs {
    param(
        [string]$ServiceId,
        [string]$ApiKey,
        [int]$Limit,
        [string]$Since
    )
    
    Write-Host "Fetching logs for service: $ServiceId" -ForegroundColor Cyan
    
    try {
        $headers = @{
            "Authorization" = "Bearer $ApiKey"
            "Accept" = "application/json"
        }
        
        $url = "$RENDER_API_BASE/services/$ServiceId/logs"
        $queryParams = @()
        
        if ($Limit -gt 0) {
            $queryParams += "limit=$Limit"
        }
        if ($Since) {
            $queryParams += "since=$Since"
        }
        
        if ($queryParams.Count -gt 0) {
            $url += "?" + ($queryParams -join '&')
        }
        
        Write-Host "Request URL: $url" -ForegroundColor Gray
        
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -ErrorAction Stop
        
        return $response
    } catch {
        Write-Host "❌ Error fetching logs: $_" -ForegroundColor Red
        
        # Check if it's an authentication error
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "⚠️  Authentication failed. Please check your API key." -ForegroundColor Yellow
        } elseif ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "⚠️  Service not found or logs endpoint not available." -ForegroundColor Yellow
        }
        
        return $null
    }
}

# Main execution
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Render Logs Fetcher (API)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Get service ID if not provided
if (-not $ServiceId) {
    $ServiceId = Get-ServiceId -Name $ServiceName -ApiKey $ApiKey
    if (-not $ServiceId) {
        Write-Host "❌ Could not find service ID. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Fetch logs
$logs = Get-RenderLogs -ServiceId $ServiceId -ApiKey $ApiKey -Limit $Limit -Since $Since

if (-not $logs) {
    Write-Host "❌ Failed to fetch logs. Exiting." -ForegroundColor Red
    exit 1
}

# Generate output filename if not provided
if (-not $OutputFile) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputFile = "render-logs-api-$ServiceName-$timestamp.txt"
}

# Process logs
$logText = ""
if ($logs.logs) {
    $logText = $logs.logs -join "`n"
} elseif ($logs -is [string]) {
    $logText = $logs
} elseif ($logs -is [array]) {
    $logText = $logs -join "`n"
} else {
    # Try to convert to JSON and extract
    $logText = ($logs | ConvertTo-Json -Depth 10)
}

# Apply filter if specified
if ($Filter -and $logText) {
    $filteredLines = $logText -split "`n" | Select-String -Pattern $Filter
    $logText = $filteredLines -join "`n"
    
    if ($Filter) {
        $filteredFile = $OutputFile.Replace(".txt", "-filtered.txt")
        $logText | Out-File -FilePath $filteredFile -Encoding UTF8
        Write-Host "✓ Filtered logs saved to: $filteredFile" -ForegroundColor Green
        Write-Host "  Filter pattern: $Filter" -ForegroundColor Gray
    }
}

# Save logs
$logText | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host ""
Write-Host "✓ Logs saved to: $OutputFile" -ForegroundColor Green

# Show stats
$lineCount = ($logText -split "`n").Count
$fileSize = (Get-Item $OutputFile).Length / 1KB
Write-Host ""
Write-Host "Log file stats:" -ForegroundColor Cyan
Write-Host "  Lines: $lineCount" -ForegroundColor White
Write-Host "  Size: $([math]::Round($fileSize, 2)) KB" -ForegroundColor White

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
