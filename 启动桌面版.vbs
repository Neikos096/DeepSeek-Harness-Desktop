Option Explicit

' wscript.exe is a GUI host. Start Electron directly so no CMD process is
' created or kept open while the desktop app runs.
Dim shell, fileSystem, projectDir, electronExe, command

If WScript.Arguments.Count > 0 Then
  WScript.Quit 0
End If

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
projectDir = fileSystem.GetParentFolderName(WScript.ScriptFullName)
electronExe = fileSystem.BuildPath(projectDir, "node_modules\electron\dist\electron.exe")

If Not fileSystem.FileExists(electronExe) Then
  MsgBox "Desktop dependencies are missing. Run install-deps.bat first.", 16, "DeepSeek Harness Desktop"
  WScript.Quit 1
End If

shell.CurrentDirectory = projectDir
command = Chr(34) & electronExe & Chr(34) & " " & Chr(34) & projectDir & Chr(34)
shell.Run command, 1, False
