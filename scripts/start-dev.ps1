# Starts the Next.js dev server and keeps a copy of its output in logs\dev-server.log
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null
if (-not (Test-Path "$root\node_modules\next")) {
  Write-Host "Packages are missing, installing first..." -ForegroundColor Yellow
  & "$PSScriptRoot\install.ps1"
}
Write-Host "Starting BiteRoute at http://localhost:3000" -ForegroundColor Cyan
& npm.cmd run dev 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath "$root\logs\dev-server.log"
