#!/usr/bin/env pwsh

Write-Host "🔧 Fixing TypeScript configuration issues..." -ForegroundColor Yellow

# Change to the carrot directory
Set-Location "c:\Users\danie\CascadeProjects\windsurf-project\carrot"

# Remove the conflicting src/tsconfig.json file
$srcTsConfig = "src\tsconfig.json"
if (Test-Path $srcTsConfig) {
    Write-Host "📁 Removing conflicting src/tsconfig.json..." -ForegroundColor Yellow
    Remove-Item $srcTsConfig -Force
    Write-Host "✅ Removed src/tsconfig.json" -ForegroundColor Green
} else {
    Write-Host "ℹ️  src/tsconfig.json not found, skipping..." -ForegroundColor Cyan
}

# Verify the main tsconfig.json is properly configured
Write-Host "📋 Checking main tsconfig.json configuration..." -ForegroundColor Yellow
if (Test-Path "tsconfig.json") {
    Write-Host "✅ Main tsconfig.json exists" -ForegroundColor Green
} else {
    Write-Host "❌ Main tsconfig.json missing!" -ForegroundColor Red
    exit 1
}

# Check if the path mapping is correct
$tsConfigContent = Get-Content "tsconfig.json" -Raw
if ($tsConfigContent -match '"@/\*":\s*\[\s*"\./src/\*"\s*\]') {
    Write-Host "✅ Path mapping is correctly configured" -ForegroundColor Green
} else {
    Write-Host "⚠️  Path mapping might need adjustment" -ForegroundColor Yellow
}

Write-Host "`n🎯 TypeScript configuration fixes completed!" -ForegroundColor Green
Write-Host "💡 You may need to restart your IDE or TypeScript language server for changes to take effect." -ForegroundColor Cyan
