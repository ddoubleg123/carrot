# Script to apply CORS fixes using Firebase CLI
# This addresses the upgrade-insecure-requests CORS error

Write-Host "Applying CORS configuration fixes using Firebase CLI..." -ForegroundColor Green

# Check if Firebase CLI is available
try {
    $firebaseVersion = & firebase --version 2>$null
    Write-Host "Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Firebase CLI not found. Please install Firebase CLI first." -ForegroundColor Red
    Write-Host "Install with: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in
try {
    $firebaseUser = & firebase login:list 2>$null
    if ($firebaseUser -match "No authorized accounts") {
        Write-Host "Please log in to Firebase first:" -ForegroundColor Yellow
        Write-Host "firebase login" -ForegroundColor White
        exit 1
    }
    Write-Host "Firebase user: $firebaseUser" -ForegroundColor Green
} catch {
    Write-Host "Please log in to Firebase first:" -ForegroundColor Yellow
    Write-Host "firebase login" -ForegroundColor White
    exit 1
}

Write-Host "`nNote: Firebase CLI doesn't directly support CORS configuration for Storage." -ForegroundColor Yellow
Write-Host "You'll need to apply the CORS configuration manually through the Google Cloud Console." -ForegroundColor Yellow

Write-Host "`nHere's what you need to do:" -ForegroundColor Green
Write-Host "1. Go to: https://console.cloud.google.com/storage/browser" -ForegroundColor White
Write-Host "2. Find your Firebase Storage bucket" -ForegroundColor White
Write-Host "3. Click on the bucket name" -ForegroundColor White
Write-Host "4. Go to the 'Permissions' tab" -ForegroundColor White
Write-Host "5. Click 'Edit CORS configuration'" -ForegroundColor White
Write-Host "6. Replace the existing configuration with:" -ForegroundColor White

Write-Host "`nCORS Configuration to apply:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Get-Content "firebase-cors.json" | Write-Host -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan

Write-Host "`nAlternatively, you can use gsutil if you have Google Cloud SDK installed:" -ForegroundColor Yellow
Write-Host "gsutil cors set firebase-cors.json gs://YOUR_BUCKET_NAME" -ForegroundColor White

Write-Host "`nThe CORS fixes have been prepared in the following files:" -ForegroundColor Green
Write-Host "✅ firebase-cors.json - Updated with requestHeader support" -ForegroundColor White
Write-Host "✅ cors.json - Updated with upgrade-insecure-requests header" -ForegroundColor White
Write-Host "✅ carrot/src/lib/retryUtils.ts - Removed problematic header from fetch" -ForegroundColor White
