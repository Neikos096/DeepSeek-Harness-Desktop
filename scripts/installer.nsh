; DeepSeek Harness 桌面版 - 安装器自定义脚本
; 在安装过程中增加"创建桌面快捷方式"勾选项(默认勾选)。

!include "MUI2.nsh"

!ifndef BUILD_UNINSTALLER

  Var dshDesktopShortcutCheckbox
  Var dshDesktopShortcutChoice

  !macro customPageAfterChangeDir
    Page custom dshOptionsCreate dshOptionsLeave
  !macroend

  Function dshOptionsCreate
    !insertmacro MUI_HEADER_TEXT "安装选项" "选择安装后的快捷方式"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 0 100% 14u "创建桌面快捷方式"
    Pop $dshDesktopShortcutCheckbox
    ${NSD_Check} $dshDesktopShortcutCheckbox
    StrCpy $dshDesktopShortcutChoice "1"
    nsDialogs::Show
  FunctionEnd

  Function dshOptionsLeave
    ${NSD_GetState} $dshDesktopShortcutCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $dshDesktopShortcutChoice "1"
    ${Else}
      StrCpy $dshDesktopShortcutChoice "0"
    ${EndIf}
  FunctionEnd

!endif

; 安装完成后,若用户取消勾选则删除默认创建的桌面快捷方式
!macro customInstall
  ${If} $dshDesktopShortcutChoice == "0"
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend
