@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 22.19+ or 24+:
  echo https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron" (
  echo [ERROR] Desktop dependencies missing. Run install-deps.bat first.
  pause
  exit /b 1
)
echo Starting DeepSeek Harness Desktop ...
call npx.cmd electron .
