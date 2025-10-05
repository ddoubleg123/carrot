# Script to apply CORS fixes for Firebase Storage
# This addresses the upgrade-insecure-requests CORS error

Write-Host "Applying CORS configuration fixes..." -ForegroundColor Green

# Check if gsutil is available
try {
    $gsutilVersion = & gsutil version 2>$null
    Write-Host "gsutil found: $($gsutilVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "Error: gsutil not found. Please install Google Cloud SDK first." -ForegroundColor Red
    Write-Host "Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Get the bucket name from environment or prompt
$bucketName = $env:FIREBASE_STORAGE_BUCKET
if (-not $bucketName) {
    $bucketName = Read-Host "Enter your Firebase Storage bucket name (e.g., your-project.appspot.com)"
}

if (-not $bucketName) {
    Write-Host "Error: Bucket name is required" -ForegroundColor Red
    exit 1
}

Write-Host "Applying CORS configuration to bucket: $bucketName" -ForegroundColor Yellow

# Apply the updated CORS configuration
try {
    & gsutil cors set firebase-cors.json gs://$bucketName
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CORS configuration applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to apply CORS configuration" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error applying CORS configuration: $_" -ForegroundColor Red
    exit 1
}

# Verify the CORS configuration
Write-Host "Verifying CORS configuration..." -ForegroundColor Yellow
try {
    & gsutil cors get gs://$bucketName
    Write-Host "✅ CORS configuration verified!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not verify CORS configuration: $_" -ForegroundColor Yellow
}

Write-Host "`nCORS fixes applied! The following changes were made:" -ForegroundColor Green
Write-Host "1. Added 'https://carrot-app.onrender.com' to allowed origins" -ForegroundColor White
Write-Host "2. Added 'requestHeader': ['*'] to allow all request headers including 'upgrade-insecure-requests'" -ForegroundColor White
Write-Host "3. Removed 'Upgrade-Insecure-Requests' header from fetch requests in retryUtils.ts" -ForegroundColor White
Write-Host "`nNote: It may take a few minutes for the CORS changes to propagate." -ForegroundColor Yellow
