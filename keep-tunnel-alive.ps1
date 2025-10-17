# Robust SSH Tunnel Manager for Stable Diffusion API
# This script keeps the SSH tunnel alive and restarts it if it fails

param(
    [string]$SSHPort = "45583",
    [string]$RemoteIP = "171.247.185.4",
    [int]$LocalPort = 7860,
    [int]$RemotePort = 7860,
    [int]$CheckInterval = 30
)

Write-Host "Starting Robust SSH Tunnel Manager for Stable Diffusion API" -ForegroundColor Green
Write-Host "Remote: $RemoteIP`:$SSHPort -> Local: localhost`:$LocalPort" -ForegroundColor Cyan
Write-Host "Health check every $CheckInterval seconds" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

function Test-Tunnel {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$LocalPort/health" -Method GET -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $data = $response.Content | ConvertFrom-Json
            return $data.status -eq "healthy" -and $data.model_loaded -eq $true
        }
    }
    catch {
        return $false
    }
    return $false
}

function Start-Tunnel {
    Write-Host "Starting SSH tunnel..." -ForegroundColor Yellow
    try {
        $process = Start-Process -FilePath "ssh" -ArgumentList @(
            "-o", "StrictHostKeyChecking=no",
            "-o", "ServerAliveInterval=60",
            "-o", "ServerAliveCountMax=3",
            "-f", "-N",
            "-L", "$LocalPort`:localhost`:$RemotePort",
            "-p", $SSHPort,
            "root@$RemoteIP"
        ) -PassThru -WindowStyle Hidden
        
        Start-Sleep -Seconds 3
        
        if (Test-Tunnel) {
            Write-Host "Tunnel established successfully!" -ForegroundColor Green
            return $process
        } else {
            Write-Host "Tunnel failed to establish" -ForegroundColor Red
            if ($process -and !$process.HasExited) {
                $process.Kill()
            }
            return $null
        }
    }
    catch {
        Write-Host "Failed to start tunnel: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Stop-Tunnel {
    Write-Host "Stopping SSH tunnel..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.Name -eq "ssh"} | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Clean up any existing tunnels
Stop-Tunnel

# Start the initial tunnel
$tunnelProcess = Start-Tunnel
if (-not $tunnelProcess) {
    Write-Host "Failed to establish initial tunnel. Exiting." -ForegroundColor Red
    exit 1
}

# Main monitoring loop
try {
    while ($true) {
        Start-Sleep -Seconds $CheckInterval
        
        if (-not (Test-Tunnel)) {
            Write-Host "Tunnel health check failed! Reconnecting..." -ForegroundColor Yellow
            Stop-Tunnel
            Start-Sleep -Seconds 2
            
            $tunnelProcess = Start-Tunnel
            if (-not $tunnelProcess) {
                Write-Host "Failed to reconnect tunnel. Retrying in 10 seconds..." -ForegroundColor Red
                Start-Sleep -Seconds 10
            }
        } else {
            Write-Host "Tunnel healthy - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Green
        }
    }
}
catch {
    Write-Host "Script interrupted. Cleaning up..." -ForegroundColor Yellow
}
finally {
    Stop-Tunnel
    Write-Host "Tunnel manager stopped." -ForegroundColor Green
}
