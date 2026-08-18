Option Explicit

' wscript.exe does not allocate a console window. The batch file owns the
' environment checks and Electron command so there is still one launch path.
Dim shell, fileSystem, batchFile, command

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
batchFile = fileSystem.BuildPath(fileSystem.GetParentFolderName(WScript.ScriptFullName), "启动桌面版.bat")
command = "cmd.exe /d /c " & Chr(34) & Chr(34) & batchFile & Chr(34) & " --run-hidden" & Chr(34)
shell.Run command, 0, False
