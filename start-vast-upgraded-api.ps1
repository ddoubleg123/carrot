# Start Upgraded SDXL API on Vast.ai
# Assumes setup is already complete

param(
    [string]$VastSSH = "ssh://root@ssh4.vast.ai:14688",
    [switch]$Background = $false
)

Write-Host "🚀 Starting Upgraded SDXL API on Vast.ai..." -ForegroundColor Green
Write-Host ""

# Extract SSH details
if ($VastSSH -match "root@(.+):(\d+)") {
    $VastHost = $matches[1]
    $VastPort = $matches[2]
} else {
    Write-Host "❌ Invalid SSH format. Expected: ssh://root@host:port" -ForegroundColor Red
    exit 1
}

Write-Host "📡 Target: $VastHost : $VastPort" -ForegroundColor Cyan
Write-Host ""

if ($Background) {
    Write-Host "🔧 Starting API in background (with tmux)..." -ForegroundColor Yellow
    $command = @"
cd /root && \
tmux new-session -d -s sdxl 'python3 upgraded-sdxl-api.py' && \
echo '✅ API started in tmux session: sdxl' && \
echo 'To view logs: tmux attach -t sdxl' && \
echo 'To detach: Ctrl+B then D'
"@
} else {
    Write-Host "🔧 Starting API (interactive mode)..." -ForegroundColor Yellow
    Write-Host "   Press Ctrl+C to stop" -ForegroundColor Cyan
    Write-Host ""
    $command = "cd /root && python3 upgraded-sdxl-api.py"
}

ssh -p $VastPort root@$VastHost $command

if ($LASTEXITCODE -ne 0 -and -not $Background) {
    Write-Host ""
    Write-Host "❌ API stopped or failed" -ForegroundColor Red
}

