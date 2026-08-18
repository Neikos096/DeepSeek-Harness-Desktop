@echo off
setlocal EnableExtensions

rem 双击 .bat 时交给 wscript 启动，避免 Electron 运行期间保留可见的 CMD 窗口。
if /i "%~1"=="--run-hidden" goto :runHidden

set "DSH_LAUNCHER=%~dp0启动桌面版.vbs"
set "DSH_ICON=%~dp0assets\icon.ico"
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $link=Join-Path $desktop 'DeepSeek Harness 桌面版.lnk'; $shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($link); $shortcut.TargetPath=Join-Path $env:SystemRoot 'System32\wscript.exe'; $shortcut.Arguments=('\"{0}\"' -f $env:DSH_LAUNCHER); $shortcut.WorkingDirectory=Split-Path -Parent $env:DSH_LAUNCHER; $shortcut.IconLocation=($env:DSH_ICON + ',0'); $shortcut.Description='启动 DeepSeek Harness 桌面版'; $shortcut.Save()" >nul 2>nul

start "" /b wscript.exe "%DSH_LAUNCHER%"
exit /b

:runHidden
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('未检测到 Node.js。请安装 Node.js 22.19+ 或 24+ 后重试。`nhttps://nodejs.org/', 'DeepSeek Harness 桌面版')" >nul 2>nul
  exit /b 1
)
if not exist "node_modules\electron" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('桌面版依赖尚未安装。请先运行“安装依赖.bat”。', 'DeepSeek Harness 桌面版')" >nul 2>nul
  exit /b 1
)
call npx.cmd electron .
exit /b
