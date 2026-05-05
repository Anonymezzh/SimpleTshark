# Check NSIS Installation
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  NSIS Installation Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if makensis is in PATH
Write-Host "[1] Checking PATH..." -ForegroundColor Yellow
$makensis = Get-Command makensis -ErrorAction SilentlyContinue
if ($makensis) {
    Write-Host "  Found in PATH: $($makensis.Source)" -ForegroundColor Green
    $version = & $makensis.Source /VERSION 2>&1
    Write-Host "  Version: $version" -ForegroundColor Green
} else {
    Write-Host "  NOT found in PATH" -ForegroundColor Red
}
Write-Host ""

# Check common installation locations
Write-Host "[2] Checking common locations..." -ForegroundColor Yellow
$locations = @(
    "${env:ProgramFiles}\NSIS\makensis.exe",
    "${env:ProgramFiles(x86)}\NSIS\makensis.exe",
    "${env:ProgramFiles}\NSIS\Bin\makensis.exe",
    "${env:ProgramFiles(x86)}\NSIS\Bin\makensis.exe"
)

$found = $false
foreach ($loc in $locations) {
    if (Test-Path $loc) {
        Write-Host "  Found: $loc" -ForegroundColor Green
        $found = $true
    }
}

if (!$found) {
    Write-Host "  Not found in standard locations" -ForegroundColor Red
}
Write-Host ""

# Check current PATH
Write-Host "[3] Current PATH contains:" -ForegroundColor Yellow
$env:Path -split ';' | Where-Object { $_ -like '*NSIS*' } | ForEach-Object {
    Write-Host "  $_" -ForegroundColor Gray
}
Write-Host ""

# Recommendations
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Recommendations" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if (!$makensis) {
    Write-Host ""
    Write-Host "NSIS is not in your PATH. To fix this:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Add NSIS to PATH manually" -ForegroundColor Cyan
    Write-Host '  $env:Path += ";C:\Program Files (x86)\NSIS"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Reinstall NSIS with PATH option enabled" -ForegroundColor Cyan
    Write-Host "  winget install NSIS.NSIS" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3: Set TAURI_PRIVATE_KEY to skip NSIS check (not recommended)" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "NSIS is correctly installed and in PATH!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If Tauri is still trying to download NSIS, try:" -ForegroundColor Yellow
    Write-Host "  1. Close and reopen PowerShell" -ForegroundColor Gray
    Write-Host "  2. Run: refreshenv (if using Chocolatey)" -ForegroundColor Gray
    Write-Host "  3. Check Tauri cache: %USERPROFILE%\.cargo\tauri\" -ForegroundColor Gray
}
Write-Host ""
