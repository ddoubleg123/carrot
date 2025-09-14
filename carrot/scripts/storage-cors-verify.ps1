# Applies CORS to a Firebase/Google Cloud Storage bucket and verifies headers
# Usage:
#   .\scripts\storage-cors-verify.ps1 -Bucket your-bucket.appspot.com -CorsJsonPath .\cors.json -TestPath "users/demo/test.mp4"
# Requires: gcloud SDK + gsutil in PATH
param(
  [Parameter(Mandatory=$true)] [string]$Bucket,
  [Parameter(Mandatory=$true)] [string]$CorsJsonPath,
  [Parameter(Mandatory=$true)] [string]$TestPath
)

function Ensure-Tool($name) {
  $exists = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $exists) { throw "Required tool '$name' not found in PATH." }
}

try {
  Ensure-Tool gsutil
  Ensure-Tool curl
} catch {
  Write-Error $_
  exit 1
}

if (-not (Test-Path $CorsJsonPath)) {
  Write-Error "CORS file not found: $CorsJsonPath"
  exit 1
}

Write-Host "Applying CORS from $CorsJsonPath to gs://$Bucket ..."
$apply = & gsutil cors set $CorsJsonPath gs://$Bucket 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error $apply; exit 1 }
Write-Host "CORS applied. Verifying..."

# Build a public/download URL (alt=media) for verification
$encPath = [System.Uri]::EscapeDataString($TestPath)
$verifyUrl = "https://firebasestorage.googleapis.com/v0/b/$Bucket/o/$encPath?alt=media"

Write-Host "HEAD $verifyUrl"
$head = & curl -sSI $verifyUrl
Write-Host $head

# Expectations: Accept-Ranges, Content-Type, Content-Length present, and no CORS block
if ($head -notmatch "Accept-Ranges" -or $head -notmatch "Content-Type") {
  Write-Warning "Headers missing. Ensure the object exists and the bucket has proper metadata."
}

Write-Host "Done."
