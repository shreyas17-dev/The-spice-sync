# BiteRoute - builds the MySQL database (tables, views, functions, procedures,
# triggers, roles and sample data). Started by setup-database.bat.
param([switch]$NoPause)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null
$log = "$root\logs\database-setup.log"
Write-Host ""
Write-Host "  BiteRoute - MySQL database setup" -ForegroundColor Cyan
Write-Host "  ---------------------------------"

$mysql = $null
$cmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
if ($cmd) { $mysql = $cmd.Source }
if (-not $mysql) {
  $c = Get-ChildItem "C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
  if ($c) { $mysql = $c[0].FullName }
}
if (-not $mysql) {
  "mysql.exe not found" | Out-File $log -Encoding utf8
  Write-Host "  mysql.exe was not found. Is MySQL Server installed?" -ForegroundColor Red
  if (-not $NoPause) { Read-Host "  Press Enter to close" }; exit 1
}

$svc = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne "Running" } | Select-Object -First 1
if ($svc) {
  try { Start-Service $svc.Name -ErrorAction Stop; Write-Host "  Started service $($svc.Name)" }
  catch { Write-Host "  The MySQL service is stopped. Start it from Services (or run this as administrator)." -ForegroundColor Yellow }
}

$sec = Read-Host "  Enter your MySQL root password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$env:MYSQL_PWD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

Write-Host "  Building the database, this takes about a minute..."
$out = & $mysql -u root --default-character-set=utf8mb4 --table -e "source database/setup_all.sql" 2>&1
$code = $LASTEXITCODE
Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue

"mysql: $mysql" | Out-File $log -Encoding utf8
"exit code: $code" | Out-File $log -Append -Encoding utf8
$out | ForEach-Object { "$_" } | Out-File $log -Append -Encoding utf8
$out | Select-Object -Last 25 | ForEach-Object { Write-Host "  $_" }
Write-Host ""
if ($code -eq 0) { Write-Host "  Database ready." -ForegroundColor Green }
else { Write-Host "  Something failed. Details are in logs\database-setup.log" -ForegroundColor Red }
if (-not $NoPause) { Read-Host "  Press Enter to close" }
