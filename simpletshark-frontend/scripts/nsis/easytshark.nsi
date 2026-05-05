; ====================================
; Modern UI Configuration for SimpleTshark
; ====================================

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; If not provided via /D defines, set safe defaults
!ifndef APP_NAME
  !define APP_NAME "SimpleTshark"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif
!ifndef APP_SRC
  !define APP_SRC "."
!endif
!ifndef EXE_NAME
  !define EXE_NAME "SimpleTshark.exe"
!endif
!ifndef OUTPUT_DIR
  !define OUTPUT_DIR "."
!endif
!ifndef INSTALLER_NAME
  ; Default fallback when a custom name is not provided via /DINSTALLER_NAME
  !define INSTALLER_NAME "${APP_NAME}-${APP_VERSION}-setup.exe"
!endif

; ====================================
; General Settings
; ====================================
Name "${APP_NAME}"
OutFile "${OUTPUT_DIR}\${INSTALLER_NAME}"
InstallDir "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

; Set font to Microsoft YaHei
SetFont "Microsoft YaHei UI" 9

; ====================================
; Modern UI Appearance Settings
; ====================================

; Interface Settings
!define MUI_ABORTWARNING

; Custom icon - use project logo
!define CUSTOM_ICON "${__FILEDIR__}\..\..\public\logo.ico"
!if /FileExists "${CUSTOM_ICON}"
  !define MUI_ICON "${CUSTOM_ICON}"
  !define MUI_UNICON "${CUSTOM_ICON}"
!else
  !define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install-blue.ico"
  !define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall-blue.ico"
!endif

; Custom images - check if custom images exist, otherwise use default
!define CUSTOM_HEADER "${__FILEDIR__}\images\header.bmp"
!define CUSTOM_WIZARD "${__FILEDIR__}\images\wizard.bmp"

; Header image
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!if /FileExists "${CUSTOM_HEADER}"
  !define MUI_HEADERIMAGE_BITMAP "${CUSTOM_HEADER}"
  !define MUI_HEADERIMAGE_UNBITMAP "${CUSTOM_HEADER}"
!else
  !define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-metro.bmp"
  !define MUI_HEADERIMAGE_UNBITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-metro.bmp"
!endif

; Welcome/Finish page image
!if /FileExists "${CUSTOM_WIZARD}"
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${CUSTOM_WIZARD}"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${CUSTOM_WIZARD}"
!else
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-metro.bmp"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-metro.bmp"
!endif

; Custom colors
!define MUI_BGCOLOR FFFFFF
!define MUI_TEXTCOLOR 000000

; ====================================
; Pages
; ====================================

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY

; Component Selection Page
Page custom ComponentsPage ComponentsPageLeave

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ====================================
; Languages
; ====================================
!insertmacro MUI_LANGUAGE "SimpChinese"

; ====================================
; Custom Text Overrides
; ====================================

; Use MUI2's built-in Chinese language pack
; No need to define custom strings, MUI2 already has Chinese translations

!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE_NAME}"
!define MUI_FINISHPAGE_LINK_LOCATION "https://www.simpletshark.com/"

; ====================================
; Variables
; ====================================
Var CreateDesktopShortcut
Var CreateStartMenuShortcut

; ====================================
; Custom Components Page
; ====================================
Function ComponentsPage
  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Please select the installation options you want:"
  Pop $0

  ${NSD_CreateCheckBox} 10 30u 100% 12u "Create Desktop Shortcut"
  Pop $CreateDesktopShortcut
  ${NSD_Check} $CreateDesktopShortcut

  ${NSD_CreateCheckBox} 10 50u 100% 12u "Create Start Menu Shortcut"
  Pop $CreateStartMenuShortcut
  ${NSD_Check} $CreateStartMenuShortcut

  nsDialogs::Show
FunctionEnd

Function ComponentsPageLeave
  ; Save the checkbox states to variables
  ${NSD_GetState} $CreateDesktopShortcut $CreateDesktopShortcut
  ${NSD_GetState} $CreateStartMenuShortcut $CreateStartMenuShortcut
FunctionEnd

; ====================================
; Installation Section
; ====================================
Section "Install" SecMain
  SetOutPath "$INSTDIR"

  ; Copy all files
  File /r "${APP_SRC}\*.*"

  ; Write installation directory
  WriteRegStr HKLM "Software\${APP_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\${APP_NAME}" "Version" "${APP_VERSION}"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Add uninstall information to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\${EXE_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "Xuanyuan"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1

  ; Calculate and write install size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "EstimatedSize" "$0"

  ; Create shortcuts based on user selection
  ${If} $CreateDesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${EXE_NAME}" "" "$INSTDIR\${EXE_NAME}" 0
  ${EndIf}

  ${If} $CreateStartMenuShortcut == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${EXE_NAME}" "" "$INSTDIR\${EXE_NAME}" 0
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
  ${EndIf}

SectionEnd

; ====================================
; Uninstallation Section
; ====================================
Section "Uninstall"
  ; Remove from PATH
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"

  ; Try to remove ";$INSTDIR"
  Push "$0"
  Push ";$INSTDIR"
  Push ""
  Call un.StrRep
  Pop $1

  ; Try to remove "$INSTDIR;"
  Push "$1"
  Push "$INSTDIR;"
  Push ""
  Call un.StrRep
  Pop $2

  ; Try to remove "$INSTDIR" (in case it's the only entry)
  Push "$2"
  Push "$INSTDIR"
  Push ""
  Call un.StrRep
  Pop $3

  WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$3"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000

  ; Delete shortcuts
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  ; Delete installation files
  RMDir /r "$INSTDIR"

  ; Delete registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  DeleteRegKey HKLM "Software\${APP_NAME}"
SectionEnd

; ====================================
; String Functions
; ====================================

Function StrContains
  Exch $R1 ; needle
  Exch
  Exch $R2 ; haystack
  Push $R3
  Push $R4
  Push $R5

  StrLen $R3 $R1
  StrCpy $R4 0

  loop:
    StrCpy $R5 $R2 $R3 $R4
    StrCmp $R5 $R1 done
    StrCmp $R5 "" done
    IntOp $R4 $R4 + 1
    Goto loop
  done:

  StrCpy $R1 $R5
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Exch $R1
FunctionEnd

Function StrRep
  Exch $R4 ; new
  Exch
  Exch $R3 ; old
  Exch 2
  Exch $R1 ; string
  Push $R2 ; result
  Push $R5 ; temp
  Push $R6 ; len(old)
  Push $R7 ; len(new)

  StrCpy $R2 ""
  StrLen $R6 $R3
  StrLen $R7 $R4

  loop:
    StrCpy $R5 $R1 $R6
    StrCmp $R5 $R3 found
    StrCpy $R5 $R1 1
    StrCpy $R2 $R2$R5
    StrCpy $R1 $R1 "" 1
    StrCmp $R1 "" done loop

  found:
    StrCpy $R2 $R2$R4
    StrCpy $R1 $R1 "" $R6
    Goto loop

  done:
    StrCpy $R3 $R2
    Pop $R7
    Pop $R6
    Pop $R5
    Pop $R2
    Pop $R1
    Pop $R4
    Exch $R3
FunctionEnd

; Uninstaller version of StrRep
Function un.StrRep
  Exch $R4 ; new
  Exch
  Exch $R3 ; old
  Exch 2
  Exch $R1 ; string
  Push $R2 ; result
  Push $R5 ; temp
  Push $R6 ; len(old)
  Push $R7 ; len(new)

  StrCpy $R2 ""
  StrLen $R6 $R3
  StrLen $R7 $R4

  loop:
    StrCpy $R5 $R1 $R6
    StrCmp $R5 $R3 found
    StrCpy $R5 $R1 1
    StrCpy $R2 $R2$R5
    StrCpy $R1 $R1 "" 1
    StrCmp $R1 "" done loop

  found:
    StrCpy $R2 $R2$R4
    StrCpy $R1 $R1 "" $R6
    Goto loop

  done:
    StrCpy $R3 $R2
    Pop $R7
    Pop $R6
    Pop $R5
    Pop $R2
    Pop $R1
    Pop $R4
    Exch $R3
FunctionEnd
