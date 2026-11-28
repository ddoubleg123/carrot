# PowerShell script to fetch Render logs using Render CLI
# Usage: .\fetch-render-logs.ps1 [options]

param(
    [string]$ServiceName = "carrot-app",
    [int]$Lines = 1000,
    [string]$OutputFile = "",
    [string]$Filter = "",
    [switch]$Tail,
    [string]$Since = ""
)

# Check if Render CLI is installed
$renderInstalled = Get-Command render -ErrorAction SilentlyContinue
if (-not $renderInstalled) {
    Write-Host "❌ Render CLI is not installed." -ForegroundColor Red
    Write-Host "Install it with: npm install -g render-cli" -ForegroundColor Yellow
    Write-Host "Or visit: https://github.com/renderinc/cli" -ForegroundColor Yellow
    exit 1
}

# Check if authenticated
Write-Host "Checking Render CLI authentication..." -ForegroundColor Cyan
$whoami = render whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not authenticated. Please run: render login" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Authenticated as: $whoami" -ForegroundColor Green

# Build command
$cmd = "render logs --service $ServiceName"
if ($Tail) {
    $cmd += " --tail"
}
if ($Lines -gt 0) {
    $cmd += " --lines $Lines"
}
if ($Since) {
    $cmd += " --since $Since"
}

# Determine output
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutputFile) {
    $OutputFile = "render-logs-$ServiceName-$timestamp.txt"
}

Write-Host ""
Write-Host "Fetching logs from service: $ServiceName" -ForegroundColor Cyan
Write-Host "Command: $cmd" -ForegroundColor Gray
Write-Host "Output file: $OutputFile" -ForegroundColor Gray
Write-Host ""

# Execute command
if ($Tail) {
    Write-Host "Streaming logs (press Ctrl+C to stop)..." -ForegroundColor Yellow
    Write-Host ""
    Invoke-Expression $cmd | Tee-Object -FilePath $OutputFile
} else {
    Write-Host "Fetching logs..." -ForegroundColor Yellow
    Invoke-Expression $cmd | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "✓ Logs saved to: $OutputFile" -ForegroundColor Green
    
    # Filter if requested
    if ($Filter) {
        $filteredFile = $OutputFile.Replace(".txt", "-filtered.txt")
        Get-Content $OutputFile | Select-String -Pattern $Filter | Out-File -FilePath $filteredFile -Encoding UTF8
        Write-Host "✓ Filtered logs saved to: $filteredFile" -ForegroundColor Green
        Write-Host "  Filter pattern: $Filter" -ForegroundColor Gray
    }
    
    # Show stats
    $lineCount = (Get-Content $OutputFile | Measure-Object -Line).Lines
    $fileSize = (Get-Item $OutputFile).Length / 1KB
    Write-Host ""
    Write-Host "Log file stats:" -ForegroundColor Cyan
    Write-Host "  Lines: $lineCount" -ForegroundColor White
    Write-Host "  Size: $([math]::Round($fileSize, 2)) KB" -ForegroundColor White
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
