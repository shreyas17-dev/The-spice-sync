@echo off
title BiteRoute
cd /d "%~dp0"
if not exist logs mkdir logs
where node >nul 2>nul
if errorlevel 1 goto nonode
if exist node_modules\next goto run
echo.
echo   Installing packages - first time only, this takes 2 to 5 minutes...
call npm install --no-audit --no-fund > logs\npm-install.log 2>&1
if errorlevel 1 goto installfail
echo   Packages installed.
:run
echo.
echo   Starting BiteRoute at http://localhost:3000  - keep this window open.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& npm.cmd run dev 2>&1 | Tee-Object -FilePath 'logs\dev-server.log'"
pause
exit /b 0
:nonode
echo   Node.js was not found. Install it from https://nodejs.org and try again.
pause
exit /b 1
:installfail
echo   npm install failed. The last lines of logs\npm-install.log:
powershell -NoProfile -Command "Get-Content 'logs\npm-install.log' -Tail 25"
pause
exit /b 1
