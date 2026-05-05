# Fix NSIS PATH for Tauri Build
# This script ensures NSIS is in PATH before building

$ErrorActionPreference = 'Stop'

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  NSIS PATH Fix" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Find NSIS installation
$nsisPath = $null
$locations = @(
    "${env:ProgramFiles}\NSIS",
    "${env:ProgramFiles(x86)}\NSIS",
    "${env:ProgramFiles}\NSIS\Bin",
    "${env:ProgramFiles(x86)}\NSIS\Bin"
)

foreach ($loc in $locations) {
    $exePath = Join-Path $loc "makensis.exe"
    if (Test-Path $exePath) {
        $nsisPath = $loc
        Write-Host "Found NSIS at: $nsisPath" -ForegroundColor Green
        break
    }
}

if (!$nsisPath) {
    Write-Host "ERROR: NSIS not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install NSIS first:" -ForegroundColor Yellow
    Write-Host "  winget install NSIS.NSIS" -ForegroundColor Gray
    exit 1
}

# Add to PATH for current session
if (-not ($env:Path -split ';' -contains $nsisPath)) {
    Write-Host "Adding NSIS to PATH..." -ForegroundColor Yellow
    $env:Path = "$nsisPath;$env:Path"
}

# Verify
$makensis = Get-Command makensis -ErrorAction SilentlyContinue
if ($makensis) {
    $version = & $makensis.Source /VERSION 2>&1
    Write-Host "NSIS version: $version" -ForegroundColor Green
    Write-Host "Location: $($makensis.Source)" -ForegroundColor Green
} else {
    Write-Host "ERROR: makensis still not found in PATH" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PATH is now configured correctly!" -ForegroundColor Green
Write-Host "You can now run: npm run tauri-build-win" -ForegroundColor Cyan
Write-Host ""
