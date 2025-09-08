# Backup local SQLite DB (dev) to backups/ with timestamp.
$ErrorActionPreference = 'Stop'

$root = (Split-Path $PSScriptRoot -Parent)
$carrot = Join-Path $root 'carrot'
$defaultDbRel = 'prisma/dev.db'
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root 'backups'

if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

# Resolve DB path
$envUrl = $env:DATABASE_URL
if ([string]::IsNullOrEmpty($envUrl)) { $envUrl = "file:./$defaultDbRel" }
if ($envUrl -notlike 'file:*') {
  Write-Host "[db-backup] DATABASE_URL is not a SQLite file:. Using default dev db." -ForegroundColor Yellow
  $dbPath = Join-Path $carrot $defaultDbRel
} else {
  $rel = $envUrl.Substring(5)
  if ([System.IO.Path]::IsPathRooted($rel)) { $dbPath = $rel } else { $dbPath = Join-Path $root $rel }
}

if (!(Test-Path $dbPath)) { throw "DB file not found: $dbPath" }

# Build backup path
$dbName = [System.IO.Path]::GetFileNameWithoutExtension($dbPath)
$dest = Join-Path $backupDir ("${dbName}-" + $ts + '.db')

Copy-Item -Path $dbPath -Destination $dest -Force
$size = (Get-Item $dest).Length
Write-Host "[db-backup] Backup created: $dest ($([Math]::Round($size/1KB,2)) KB)" -ForegroundColor Green
