@echo off
cd /d "%~dp0"
if exist "%~dp0.runtime\node.exe" set "PATH=%~dp0.runtime;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 22.15 or newer is required. Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (call npm install)
start "DAYFLOW" /min cmd /c "npm run dev"
timeout /t 4 /nobreak >nul
start http://127.0.0.1:5173
