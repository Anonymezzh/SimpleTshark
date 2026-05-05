@echo off
chcp 65001 >nul
setlocal ENABLEDELAYEDEXPANSION

REM Prefer unified PowerShell build script for robustness
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  powershell -ExecutionPolicy Bypass -File "%~dp0tauri-build-win.ps1" %*
  exit /b %ERRORLEVEL%
)

REM Fallback to legacy BAT flow when PowerShell is unavailable
REM Resolve project root
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.." >nul

echo ======================================
echo   Tauri Windows Build (NSIS)
echo ======================================

REM Ensure Rust in PATH
set "CARGO_HOME=%USERPROFILE%\.cargo"
set "RUSTUP_HOME=%USERPROFILE%\.rustup"
if exist "%CARGO_HOME%\bin" set "PATH=%CARGO_HOME%\bin;%PATH%"

REM Try common install locations if cargo still missing
where cargo >nul 2>&1
if errorlevel 1 (
  set "FOUND_CARGO="
  for %%D in ("%USERPROFILE%\.cargo\bin\cargo.exe" "C:\\Program Files\\Rust\\bin\\cargo.exe" "C:\\Program Files\\Rust stable MSVC\\bin\\cargo.exe" "C:\\Program Files (x86)\\Rust\\bin\\cargo.exe" "%LOCALAPPDATA%\\Programs\\Rust\\bin\\cargo.exe") do (
    if exist "%%~fD" set "FOUND_CARGO=%%~dpD"
  )
  if defined FOUND_CARGO set "PATH=%FOUND_CARGO%;%PATH%"
)

where cargo >nul 2>&1
if errorlevel 1 goto no_rust

REM [1/4] Sync version
echo [1/4] Sync version...
del /q .version.tmp 2>nul
node -e "process.stdout.write(require('./package.json').version)" > .version.tmp
if errorlevel 1 goto error
set /p VERSION=< .version.tmp
del /q .version.tmp 2>nul
if "%VERSION%"=="" goto error

REM Update Cargo.toml
node -e "const fs=require('fs');const p='src-tauri/Cargo.toml';let s=fs.readFileSync(p,'utf8');s=s.replace(/^version\\s*=\\s*\\\"[^\\\"]*\\\"/m, 'version = \"%VERSION%\"');fs.writeFileSync(p,s)" || goto error

REM Update tauri.conf.json
node -e "const fs=require('fs');const p='src-tauri/tauri.conf.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version='%VERSION%';fs.writeFileSync(p,JSON.stringify(j,null,2))" || goto error

echo Synced version: %VERSION%

REM [2/4] Prepare resources
echo [2/4] Prepare Windows resources...
set "SRC=resources\tshark_win"
set "DST=src-tauri"
if not exist "%SRC%" (
  echo Resource directory not found: %SRC%
  popd >nul & exit /b 1
)

REM Clean old resources
del /q "%DST%\tshark_server" 2>nul
del /q "%DST%\tshark_server.exe" 2>nul
del /q "%DST%\tshark_server_helper.exe" 2>nul
del /q "%DST%\tshark_fields.db" 2>nul
if exist "%DST%\tshark" rmdir /s /q "%DST%\tshark"

robocopy "%SRC%" "%DST%" /e >nul
if %ERRORLEVEL% GEQ 8 goto error
echo Resources copied to src-tauri\

REM Early NSIS check
where makensis >nul 2>&1
if errorlevel 1 (
  echo ERROR: NSIS (makensis) not found. Cannot build installer.
  echo Install with: winget install NSIS.NSIS
  echo Or download:
  echo   https://nsis.sourceforge.io/Download
  echo Rerun: npm run tauri-build-win
  goto error
)

REM [3/4] Build
echo [3/4] Build Tauri (NSIS)...
set "TAURI_CONFIG_PATH=src-tauri\tauri.windows.conf.json"
call npx tauri build || goto error
echo Build complete. Output in src-tauri\target\release\bundle\

REM [4/4] Cleanup
echo [4/4] Cleanup temporary resources...
del /q "%DST%\tshark_server" 2>nul
del /q "%DST%\tshark_server.exe" 2>nul
del /q "%DST%\tshark_server_helper.exe" 2>nul
del /q "%DST%\tshark_fields.db" 2>nul
if exist "%DST%\tshark" rmdir /s /q "%DST%\tshark"
echo Cleanup done.

echo.
echo Done.
popd >nul
exit /b 0

:no_rust
echo Rust toolchain (cargo) not found in PATH.
echo Install Rust MSVC toolchain, reopen terminal, then retry.
echo Example: winget install Rustlang.Rust.MSVC
popd >nul
exit /b 1

:error
echo Build failed. Exit code: %ERRORLEVEL%
popd >nul
exit /b %ERRORLEVEL%
