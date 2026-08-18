@echo off
setlocal EnableExtensions

set "DSH_LAUNCHER=%~dp0启动桌面版.vbs"
set "DSH_ICON=%~dp0assets\icon.ico"
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $link=Join-Path $desktop 'DeepSeek Harness 桌面版.lnk'; $shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($link); $shortcut.TargetPath=Join-Path $env:SystemRoot 'System32\wscript.exe'; $shortcut.Arguments=('\"{0}\"' -f $env:DSH_LAUNCHER); $shortcut.WorkingDirectory=Split-Path -Parent $env:DSH_LAUNCHER; if (Test-Path $env:DSH_ICON) { $shortcut.IconLocation=($env:DSH_ICON + ',0') }; $shortcut.Description='启动 DeepSeek Harness 桌面版'; $shortcut.Save()" >nul 2>nul

start "" /b wscript.exe "%DSH_LAUNCHER%"
exit /b
