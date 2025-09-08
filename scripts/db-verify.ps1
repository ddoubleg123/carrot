# Verify basic DB health for local SQLite (dev)
$ErrorActionPreference = 'Stop'

$root = (Split-Path $PSScriptRoot -Parent)
$carrot = Join-Path $root 'carrot'
$defaultDbRel = 'prisma/dev.db'

# Resolve DB path
$envUrl = $env:DATABASE_URL
if ([string]::IsNullOrEmpty($envUrl)) { $envUrl = "file:./$defaultDbRel" }
if ($envUrl -notlike 'file:*') {
  Write-Host "[db-verify] DATABASE_URL is not a SQLite file:. Using default dev db." -ForegroundColor Yellow
  $dbPath = Join-Path $carrot $defaultDbRel
} else {
  $rel = $envUrl.Substring(5)
  if ([System.IO.Path]::IsPathRooted($rel)) { $dbPath = $rel } else { $dbPath = Join-Path $root $rel }
}

if (!(Test-Path $dbPath)) { throw "DB file not found: $dbPath" }

# Use sqlite3 if available
$sqlite = Get-Command sqlite3 -ErrorAction SilentlyContinue
if (-not $sqlite) {
  Write-Host "[db-verify] sqlite3 not found in PATH. Install sqlite3 to use this script." -ForegroundColor Yellow
  exit 0
}

Write-Host "[db-verify] Using DB: $dbPath"

& $sqlite $dbPath "SELECT 'User' AS table_name, COUNT(*) AS count FROM User;" | Write-Host
& $sqlite $dbPath "SELECT 'Post' AS table_name, COUNT(*) AS count FROM Post;" | Write-Host

# Check presence of profile_photo_path column
& $sqlite $dbPath "PRAGMA table_info('User');" | Select-String -Pattern "profile_photo_path" | ForEach-Object { $_ } | Write-Host

# Show latest 5 posts
Write-Host "[db-verify] Latest 5 posts:"
& $sqlite $dbPath "SELECT id, substr(content,1,30) AS content30, createdAt FROM Post ORDER BY createdAt DESC LIMIT 5;" | Write-Host
