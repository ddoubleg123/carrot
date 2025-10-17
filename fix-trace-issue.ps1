#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fix the Next.js trace file EPERM issue

.DESCRIPTION
    This script fixes the common EPERM error with the .next/trace file
    by deleting the .next folder and restarting the dev server.

.EXAMPLE
    .\fix-trace-issue.ps1
#>

Write-Host "🔧 Fixing Next.js trace file issue..." -ForegroundColor Cyan

# Navigate to carrot directory
$carrotPath = "C:\Users\danie\CascadeProjects\windsurf-project\carrot"
Set-Location $carrotPath

Write-Host "📁 Current directory: $carrotPath" -ForegroundColor Gray

# Stop any running Node processes
Write-Host "🛑 Stopping existing Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Delete .next folder
Write-Host "🗑️  Deleting .next folder..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
    Write-Host "   ✅ .next folder deleted" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  .next folder doesn't exist (already clean)" -ForegroundColor Gray
}

# Optional: Delete node_modules/.cache
Write-Host "🗑️  Clearing node_modules cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache cleared" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  No cache to clear" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Starting dev server..." -ForegroundColor Cyan
Write-Host ""

# Start the dev server
npm run dev

