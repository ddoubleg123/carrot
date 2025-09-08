# Requires: Node.js, npm, Prisma CLI in carrot package (npx prisma)
$ErrorActionPreference = 'Stop'

# Resolve project root and carrot dir
$root = (Split-Path $PSScriptRoot -Parent)
$carrot = Join-Path $root 'carrot'

Write-Host "[prisma-refresh] Using project root: $root"
Write-Host "[prisma-refresh] Carrot directory: $carrot"

# Ensure carrot dir exists
if (!(Test-Path $carrot)) {
  throw "Carrot directory not found: $carrot"
}

# Run Prisma format and generate from carrot/
Push-Location $carrot
try {
  Write-Host "[prisma-refresh] Running: npx prisma format"
  npx prisma format | Write-Host

  Write-Host "[prisma-refresh] Running: npx prisma generate"
  npx prisma generate | Write-Host

  Write-Host "[prisma-refresh] Prisma client refreshed successfully."
}
finally {
  Pop-Location
}
