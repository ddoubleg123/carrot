# Create SSH Key for New Vast.ai Server
# This creates a dedicated SSH key for your second server

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "CREATING SSH KEY FOR NEW VAST.AI SERVER" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$KEY_NAME = "vast-sdxl-server-key"
$KEY_PATH = "$env:USERPROFILE\.ssh\$KEY_NAME"

Write-Host "🔑 Creating SSH key for new Vast.ai server..." -ForegroundColor Yellow
Write-Host "Key name: $KEY_NAME" -ForegroundColor Gray
Write-Host "Key path: $KEY_PATH" -ForegroundColor Gray
Write-Host ""

# Check if key already exists
if (Test-Path "$KEY_PATH") {
    Write-Host "⚠️  SSH key already exists at: $KEY_PATH" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "❌ Key creation cancelled" -ForegroundColor Red
        exit 1
    }
}

# Create SSH directory if it doesn't exist
$sshDir = "$env:USERPROFILE\.ssh"
if (!(Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
    Write-Host "📁 Created SSH directory: $sshDir" -ForegroundColor Green
}

# Generate SSH key
Write-Host "🔨 Generating SSH key..." -ForegroundColor Yellow
ssh-keygen -t rsa -b 4096 -f "$KEY_PATH" -N '""' -C "vast-sdxl-server-$(Get-Date -Format 'yyyyMMdd')"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSH key created successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Display public key
    Write-Host "📋 PUBLIC KEY (copy this to Vast.ai):" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    $publicKey = Get-Content "$KEY_PATH.pub"
    Write-Host $publicKey -ForegroundColor White
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Copy to clipboard
    try {
        $publicKey | Set-Clipboard
        Write-Host "📋 Public key copied to clipboard!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not copy to clipboard (manual copy required)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "📝 NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Copy the public key above" -ForegroundColor White
    Write-Host "2. Go to your Vast.ai instance settings" -ForegroundColor White
    Write-Host "3. Paste the key in the 'SSH Key' field" -ForegroundColor White
    Write-Host "4. Save the instance configuration" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 SSH Connection Command:" -ForegroundColor Yellow
    Write-Host "ssh -i `"$KEY_PATH`" -p [PORT] root@[HOST]" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host "❌ Failed to create SSH key" -ForegroundColor Red
    exit 1
}

Write-Host "✅ SSH key setup complete!" -ForegroundColor Green
