$ErrorActionPreference = 'SilentlyContinue'

function Save-Json($obj, $path){ try { ($obj | ConvertTo-Json -Depth 8) | Out-File -FilePath $path -Encoding UTF8 } catch { "" | Out-File -FilePath $path -Encoding UTF8 } }
function Save-Text($text, $path){ try { $text | Out-File -FilePath $path -Encoding UTF8 } catch { "" | Out-File -FilePath $path -Encoding UTF8 } }
function Log($label){ Write-Host ("`n== {0} ==" -f $label) }

# Ensure we run from repo root
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $repoRoot

# Stop :8080 if it's the worker we manage
$own = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($own) {
  $pid = $own.OwningProcess
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $pid" -ErrorAction SilentlyContinue
  $cmd = $proc.CommandLine
  if ($cmd -and ($cmd -match 'node' -and $cmd -match 'worker\\dist\\index.js')) {
    Log "Stopping worker on 8080 (PID=$pid)"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  } else {
    Log "8080 owned by other process; skipping stop. PID=$pid"
  }
}

# Start worker
Log 'Starting worker'
& ".\worker\start-worker.cmd" | Out-Null
Start-Sleep -Seconds 4

# Query endpoints and save
try { $r = Invoke-RestMethod http://localhost:8080/routes; Save-Json $r '.\routes_8080.json' } catch { Save-Text $_.Exception.Message '.\routes_8080.json' }
try { $s = Invoke-RestMethod http://localhost:8080/cookies/status; Save-Json $s '.\cookies_status_before.json' } catch { Save-Text $_.Exception.Message '.\cookies_status_before.json' }
try { $d = Invoke-RestMethod http://localhost:8080/debug; Save-Json $d '.\debug_8080_before.json' } catch { Save-Text $_.Exception.Message '.\debug_8080_before.json' }

# Upload cookies if present and size > 1000 bytes
$dl = Join-Path $env:USERPROFILE 'Downloads\yt-cookies.txt'
if (Test-Path $dl) {
  $size = (Get-Item $dl).Length
  if ($size -gt 1000) {
    Log "Uploading cookies from $dl (size=$size)"
    try { $u = Invoke-RestMethod -Uri http://localhost:8080/cookies/upload -Method Post -ContentType 'text/plain' -InFile $dl; Save-Json $u '.\cookies_upload_resp.json' } catch { Save-Text $_.Exception.Message '.\cookies_upload_resp.json' }
  } else { Save-Text "Downloads cookies too small ($size)" '.\cookies_upload_resp.json' }
} else { Save-Text 'No Downloads\yt-cookies.txt found' '.\cookies_upload_resp.json' }

# Query after
try { $s2 = Invoke-RestMethod http://localhost:8080/cookies/status; Save-Json $s2 '.\cookies_status_after.json' } catch { Save-Text $_.Exception.Message '.\cookies_status_after.json' }
try { $d2 = Invoke-RestMethod http://localhost:8080/debug; Save-Json $d2 '.\debug_8080_after.json' } catch { Save-Text $_.Exception.Message '.\debug_8080_after.json' }

# Tail logs to files
try { Get-Content '.\worker_8080_out_live.txt' -Tail 120 | Out-File -FilePath '.\worker_8080_out_tail.txt' -Encoding UTF8 } catch {}
try { Get-Content '.\worker_8080_err_live.txt' -Tail 80 | Out-File -FilePath '.\worker_8080_err_tail.txt' -Encoding UTF8 } catch {}

Log 'Done.'
