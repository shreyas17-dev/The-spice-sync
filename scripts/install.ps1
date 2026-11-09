# npm install with a log file (used by the VS Code task)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null
Write-Host "Installing packages (2 to 5 minutes)..." -ForegroundColor Cyan
& npm.cmd install --no-audit --no-fund 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath "$root\logs\npm-install.log"
"exit code: $LASTEXITCODE" | Out-File "$root\logs\npm-install.log" -Append
if ($LASTEXITCODE -eq 0) { Write-Host "Packages installed." -ForegroundColor Green } else { Write-Host "npm install failed, see logs\npm-install.log" -ForegroundColor Red }
