@echo off
cd /d "%~dp0"
echo [1/3] Checking Node.js ...
node --version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 22.19+ or 24+:
  echo https://nodejs.org/
  pause
  exit /b 1
)
echo [2/3] Installing desktop dependencies with npmmirror ...
call npm install --registry=https://registry.npmmirror.com
if errorlevel 1 (
  echo [ERROR] Install failed. Check your network and retry.
  pause
  exit /b 1
)
echo [3/3] Checking harness build output ...
if not exist "..\deepseek-harness\apps\web\dist\index.html" (
  echo [ERROR] Harness is not built yet. In the deepseek-harness folder run:
  echo   pnpm install
  echo   pnpm run build
  pause
  exit /b 1
)
echo.
echo Done. Double-click start-desktop.bat to launch.
pause
