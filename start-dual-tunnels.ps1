# Start Dual SSH Tunnels for Both Vast.ai Servers
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "STARTING DUAL SSH TUNNELS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER1_HOST = "ssh4.vast.ai"
$SERVER1_PORT = "14688"
$SERVER1_LOCAL_PORT = "7860"

$SERVER2_HOST = "111.59.36.106"
$SERVER2_PORT = "30400"
$SERVER2_LOCAL_PORT = "7861"

$SERVER2_HOST_PROXY = "ssh1.vast.ai"
$SERVER2_PORT_PROXY = "28963"

Write-Host "🔧 Configuration:" -ForegroundColor Yellow
Write-Host "   Server 1 (RTX 3090 Ti): $SERVER1_HOST:$SERVER1_PORT → localhost:$SERVER1_LOCAL_PORT" -ForegroundColor White
Write-Host "   Server 2 (RTX 3090): $SERVER2_HOST:$SERVER2_PORT → localhost:$SERVER2_LOCAL_PORT" -ForegroundColor White
Write-Host ""

# Kill any existing tunnels on these ports
Write-Host "🧹 Cleaning up existing tunnels..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort $SERVER1_LOCAL_PORT -ErrorAction SilentlyContinue | ForEach-Object {
    $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "ssh") {
        Stop-Process -Id $process.Id -Force
        Write-Host "   Stopped tunnel on port $SERVER1_LOCAL_PORT" -ForegroundColor Gray
    }
}

Get-NetTCPConnection -LocalPort $SERVER2_LOCAL_PORT -ErrorAction SilentlyContinue | ForEach-Object {
    $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "ssh") {
        Stop-Process -Id $process.Id -Force
        Write-Host "   Stopped tunnel on port $SERVER2_LOCAL_PORT" -ForegroundColor Gray
    }
}

# Start tunnel for Server 1 (existing)
Write-Host "🚀 Starting tunnel for Server 1 (RTX 3090 Ti)..." -ForegroundColor Yellow
$tunnel1 = Start-Process -FilePath "ssh" -ArgumentList "-p", $SERVER1_PORT, "root@$SERVER1_HOST", "-L", "${SERVER1_LOCAL_PORT}:localhost:7860", "-N" -PassThru -WindowStyle Hidden

if ($tunnel1) {
    Write-Host "   ✅ Server 1 tunnel started (PID: $($tunnel1.Id))" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to start Server 1 tunnel" -ForegroundColor Red
}

Start-Sleep 2

# Test Server 2 connection and start tunnel
Write-Host "🔍 Testing Server 2 connection..." -ForegroundColor Yellow
$testResult = ssh -p $SERVER2_PORT -o ConnectTimeout=5 -o BatchMode=yes root@$SERVER2_HOST "echo 'test'" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Direct connection to Server 2 works" -ForegroundColor Green
    $SERVER2_HOST_FINAL = $SERVER2_HOST
    $SERVER2_PORT_FINAL = $SERVER2_PORT
} else {
    Write-Host "   ⚠️  Direct connection failed, trying proxy..." -ForegroundColor Yellow
    $testResult = ssh -p $SERVER2_PORT_PROXY -o ConnectTimeout=5 -o BatchMode=yes root@$SERVER2_HOST_PROXY "echo 'test'" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Proxy connection to Server 2 works" -ForegroundColor Green
        $SERVER2_HOST_FINAL = $SERVER2_HOST_PROXY
        $SERVER2_PORT_FINAL = $SERVER2_PORT_PROXY
    } else {
        Write-Host "   ❌ Both direct and proxy connections failed" -ForegroundColor Red
        Write-Host "   Please check your Server 2 instance status" -ForegroundColor Yellow
        exit 1
    }
}

# Start tunnel for Server 2
Write-Host "🚀 Starting tunnel for Server 2 (RTX 3090)..." -ForegroundColor Yellow
$tunnel2 = Start-Process -FilePath "ssh" -ArgumentList "-p", $SERVER2_PORT_FINAL, "root@$SERVER2_HOST_FINAL", "-L", "${SERVER2_LOCAL_PORT}:localhost:7860", "-N" -PassThru -WindowStyle Hidden

if ($tunnel2) {
    Write-Host "   ✅ Server 2 tunnel started (PID: $($tunnel2.Id))" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to start Server 2 tunnel" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DUAL TUNNELS ACTIVE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Yellow
Write-Host "   Server 1 (RTX 3090 Ti): http://localhost:$SERVER1_LOCAL_PORT" -ForegroundColor White
Write-Host "   Server 2 (RTX 3090): http://localhost:$SERVER2_LOCAL_PORT" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Test both servers:" -ForegroundColor Yellow
Write-Host "   curl http://localhost:$SERVER1_LOCAL_PORT/health" -ForegroundColor Gray
Write-Host "   curl http://localhost:$SERVER2_LOCAL_PORT/health" -ForegroundColor Gray
Write-Host ""
Write-Host "🛑 To stop tunnels, press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Keep script running and monitor tunnels
try {
    while ($true) {
        Start-Sleep 10
        
        # Check if tunnels are still running
        if ($tunnel1.HasExited) {
            Write-Host "⚠️  Server 1 tunnel disconnected, restarting..." -ForegroundColor Yellow
            $tunnel1 = Start-Process -FilePath "ssh" -ArgumentList "-p", $SERVER1_PORT, "root@$SERVER1_HOST", "-L", "${SERVER1_LOCAL_PORT}:localhost:7860", "-N" -PassThru -WindowStyle Hidden
        }
        
        if ($tunnel2.HasExited) {
            Write-Host "⚠️  Server 2 tunnel disconnected, restarting..." -ForegroundColor Yellow
            $tunnel2 = Start-Process -FilePath "ssh" -ArgumentList "-p", $SERVER2_PORT_FINAL, "root@$SERVER2_HOST_FINAL", "-L", "${SERVER2_LOCAL_PORT}:localhost:7860", "-N" -PassThru -WindowStyle Hidden
        }
    }
} catch {
    Write-Host ""
    Write-Host "🛑 Stopping tunnels..." -ForegroundColor Red
    
    if ($tunnel1 -and !$tunnel1.HasExited) {
        Stop-Process -Id $tunnel1.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   Stopped Server 1 tunnel" -ForegroundColor Gray
    }
    
    if ($tunnel2 -and !$tunnel2.HasExited) {
        Stop-Process -Id $tunnel2.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   Stopped Server 2 tunnel" -ForegroundColor Gray
    }
    
    Write-Host "✅ All tunnels stopped" -ForegroundColor Green
}
