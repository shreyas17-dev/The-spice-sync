# BiteRoute - creates the Redis (Memurai) users and loads the live sample data.
# Started by setup-redis.bat.
param([switch]$NoPause)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null
$log = "$root\logs\redis-setup.log"
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
Write-Host ""
Write-Host "  BiteRoute - Redis / Memurai setup" -ForegroundColor Cyan
Write-Host "  ---------------------------------"

$cli = $null
foreach ($name in @("memurai-cli.exe", "redis-cli.exe")) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { $cli = $cmd.Source; break }
}
if (-not $cli -and (Test-Path "C:\Program Files\Memurai\memurai-cli.exe")) { $cli = "C:\Program Files\Memurai\memurai-cli.exe" }
if (-not $cli) {
  "memurai-cli / redis-cli not found" | Out-File $log -Encoding utf8
  Write-Host "  memurai-cli.exe was not found. Is Memurai installed?" -ForegroundColor Red
  if (-not $NoPause) { Read-Host "  Press Enter to close" }; exit 1
}

$svc = Get-Service -Name "Memurai*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne "Running" } | Select-Object -First 1
if ($svc) {
  try { Start-Service $svc.Name -ErrorAction Stop; Write-Host "  Started service $($svc.Name)" }
  catch { Write-Host "  The Memurai service is stopped. Start it from Services (or run this as administrator)." -ForegroundColor Yellow }
}

function Send-File($file) {
  Get-Content $file -Encoding UTF8 | Where-Object { $_.Trim() -ne "" -and -not $_.StartsWith("#") } | & $cli 2>&1
}

"cli: $cli" | Out-File $log -Encoding utf8
$ping = (& $cli PING 2>&1 | Out-String).Trim()
"PING -> $ping" | Out-File $log -Append -Encoding utf8
if ($ping -ne "PONG") {
  Write-Host "  Could not reach Memurai on port 6379: $ping" -ForegroundColor Red
  if (-not $NoPause) { Read-Host "  Press Enter to close" }; exit 1
}
$info = & $cli INFO server 2>&1 | Out-String
($info -split "`n" | Where-Object { $_ -match "version" }) | Out-File $log -Append -Encoding utf8

Write-Host "  Creating users (ACL)..."
$acl = Send-File "redis\01_setup.redis" | Out-String
"== 01_setup.redis" | Out-File $log -Append -Encoding utf8
$acl | Out-File $log -Append -Encoding utf8

Write-Host "  Loading live sample data..."
$seed = Send-File "redis\02_seed.redis" | Out-String
"== 02_seed.redis" | Out-File $log -Append -Encoding utf8
$seed | Out-File $log -Append -Encoding utf8

$geo = (& $cli GEOSEARCH partners:geo FROMLONLAT 77.627957 12.935845 BYRADIUS 5 km ASC COUNT 3 2>&1 | Out-String).Trim()
"== GEOSEARCH test`n$geo" | Out-File $log -Append -Encoding utf8

if ($acl -notmatch "fd_api") {
  Write-Host "  This Memurai version has no ACL users; the app will use the default user." -ForegroundColor Yellow
  $envFile = Join-Path $root ".env.local"
  if (Test-Path $envFile) {
    (Get-Content $envFile) -replace '^REDIS_USER=.*', 'REDIS_USER=""' -replace '^REDIS_PASS=.*', 'REDIS_PASS=""' `
      -replace '^REDIS_TRACK_USER=.*', 'REDIS_TRACK_USER=""' -replace '^REDIS_TRACK_PASS=.*', 'REDIS_TRACK_PASS=""' | Set-Content $envFile
  }
}
$errors = ([regex]::Matches($acl + $seed, "ERR")).Count
"errors: $errors" | Out-File $log -Append -Encoding utf8
Write-Host ""
if ($errors -eq 0) { Write-Host "  Redis ready." -ForegroundColor Green }
else { Write-Host "  Finished with $errors error(s). Details are in logs\redis-setup.log" -ForegroundColor Yellow }
if (-not $NoPause) { Read-Host "  Press Enter to close" }
