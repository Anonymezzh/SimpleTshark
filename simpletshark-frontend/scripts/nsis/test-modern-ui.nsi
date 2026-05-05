; Test script to verify Modern UI 2 is working
; This creates a minimal installer to test the UI appearance

!include "MUI2.nsh"

Name "UI Test"
OutFile "test-installer.exe"
InstallDir "$TEMP\UITest"

; Modern UI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install-blue.ico"

; Header image (this is the KEY difference from classic UI)
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-metro.bmp"

; Welcome page image (another KEY difference)
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-metro.bmp"

; Welcome page text
!define MUI_WELCOMEPAGE_TITLE "Modern UI 2 Test"
!define MUI_WELCOMEPAGE_TEXT "If you see a BLUE SIDEBAR on the left with a gradient, then Modern UI 2 is working!$\r$\n$\r$\nIf you DON'T see any blue sidebar, then either:$\r$\n- Your NSIS version is too old (need 3.0+)$\r$\n- The graphics files are missing$\r$\n- Modern UI is not being used"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd
