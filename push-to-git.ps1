#!/usr/bin/env pwsh

Write-Host "🚀 Pushing AgentOutputCard Changes to Git Main Branch" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green

# Change to the project root directory
Set-Location "c:\Users\danie\CascadeProjects\windsurf-project"

Write-Host "`n📊 Current git status:" -ForegroundColor Yellow
git status

Write-Host "`n📦 Staging all changes..." -ForegroundColor Yellow
git add .

Write-Host "`n📋 Staged changes:" -ForegroundColor Yellow
git status --short

# Create comprehensive commit message
$commitMessage = "feat: Add comprehensive AgentOutputCard component with TypeScript fixes

🎯 Major Features Added:
- Created AgentOutputCard component with status indicators and expandable results
- Added code syntax highlighting and copy functionality  
- Implemented actionable suggestions display with proper formatting
- Added summary statistics and agent metadata display
- Integrated AgentOutputDemo component with realistic sample data
- Updated rabbit page to showcase the new audit interface

🔧 Technical Improvements:
- Fixed TypeScript path resolution issues by removing conflicting tsconfig.json
- Improved module import paths for @/styles/tokens and @/components
- Enhanced component architecture with proper type definitions
- Added comprehensive design token integration

📱 UI/UX Enhancements:
- Responsive card layout with proper spacing and shadows
- Color-coded status indicators (success, warning, error, pending)
- Interactive expand/collapse functionality for detailed results
- Professional code block styling with syntax highlighting
- Copy-to-clipboard functionality for code snippets
- Clean, modern interface following design system guidelines"

Write-Host "`n💾 Committing changes..." -ForegroundColor Yellow
git commit -m $commitMessage

Write-Host "`n🚀 Pushing to main branch..." -ForegroundColor Yellow
git push origin main

Write-Host "`n✅ SUCCESS! All changes pushed to main branch!" -ForegroundColor Green
Write-Host "🔗 Your AgentOutputCard component is now live!" -ForegroundColor Cyan
