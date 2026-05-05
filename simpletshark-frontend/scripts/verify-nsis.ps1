# NSIS 脚本验证工具
# 用于验证自定义 NSIS 脚本是否被正确使用

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  NSIS Configuration Verification" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$root = Join-Path $PSScriptRoot '..'
$nsisScript = Join-Path $root 'scripts\nsis\simpletshark.nsi'
$tauriConf = Join-Path $root 'src-tauri\tauri.conf.json'
$tauriWinConf = Join-Path $root 'src-tauri\tauri.windows.conf.json'

# Check 1: Custom NSIS script exists
Write-Host "[Check 1] Custom NSIS script..." -NoNewline
if (Test-Path $nsisScript) {
    Write-Host " OK" -ForegroundColor Green
    $content = Get-Content $nsisScript -Raw

    # Check for Modern UI markers
    if ($content -match "MUI_HEADERIMAGE") {
        Write-Host "  - Modern UI header image: Enabled" -ForegroundColor Green
    } else {
        Write-Host "  - Modern UI header image: NOT FOUND" -ForegroundColor Red
    }

    if ($content -match "MUI_WELCOMEFINISHPAGE_BITMAP") {
        Write-Host "  - Welcome page bitmap: Enabled" -ForegroundColor Green
    } else {
        Write-Host "  - Welcome page bitmap: NOT FOUND" -ForegroundColor Red
    }

    if ($content -match "ComponentsPage") {
        Write-Host "  - Custom components page: Enabled" -ForegroundColor Green
    } else {
        Write-Host "  - Custom components page: NOT FOUND" -ForegroundColor Red
    }
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Path: $nsisScript" -ForegroundColor Yellow
}
Write-Host ""

# Check 2: Windows config references custom script
Write-Host "[Check 2] Windows config..." -NoNewline
if (Test-Path $tauriWinConf) {
    Write-Host " OK" -ForegroundColor Green
    $winConf = Get-Content $tauriWinConf -Raw | ConvertFrom-Json

    if ($winConf.bundle.windows.nsis.template) {
        $templatePath = $winConf.bundle.windows.nsis.template
        Write-Host "  - Template path: $templatePath" -ForegroundColor Green

        # Check if the template path is correct
        $expectedPath = "../scripts/nsis/simpletshark.nsi"
        if ($templatePath -eq $expectedPath) {
            Write-Host "  - Path is correct!" -ForegroundColor Green
        } else {
            Write-Host "  - WARNING: Expected '$expectedPath' but got '$templatePath'" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  - NSIS template: NOT CONFIGURED" -ForegroundColor Red
        Write-Host "    This means Tauri is using the default NSIS template!" -ForegroundColor Red
    }
} else {
    Write-Host " MISSING" -ForegroundColor Red
}
Write-Host ""

# Check 3: Test compile the NSIS script
Write-Host "[Check 3] NSIS compiler test..." -NoNewline
$makensis = Get-Command makensis -ErrorAction SilentlyContinue
if ($makensis) {
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  - makensis found at: $($makensis.Source)" -ForegroundColor Green

    # Try to get NSIS version
    $version = & $makensis.Source /VERSION 2>&1
    Write-Host "  - NSIS version: $version" -ForegroundColor Green

    # Check if Metro graphics exist
    $nsisDir = Split-Path (Split-Path $makensis.Source -Parent) -Parent
    $metroHeader = Join-Path $nsisDir "Contrib\Graphics\Header\nsis3-metro.bmp"
    $metroWizard = Join-Path $nsisDir "Contrib\Graphics\Wizard\nsis3-metro.bmp"

    if (Test-Path $metroHeader) {
        Write-Host "  - Metro header graphic: Found" -ForegroundColor Green
    } else {
        Write-Host "  - Metro header graphic: NOT FOUND" -ForegroundColor Red
        Write-Host "    Your NSIS version may be too old (need 3.0+)" -ForegroundColor Yellow
    }

    if (Test-Path $metroWizard) {
        Write-Host "  - Metro wizard graphic: Found" -ForegroundColor Green
    } else {
        Write-Host "  - Metro wizard graphic: NOT FOUND" -ForegroundColor Red
        Write-Host "    Your NSIS version may be too old (need 3.0+)" -ForegroundColor Yellow
    }
} else {
    Write-Host " NOT FOUND" -ForegroundColor Red
    Write-Host "  makensis not found in PATH" -ForegroundColor Yellow
}
Write-Host ""

# Check 4: Look for recent build output
Write-Host "[Check 4] Recent build output..." -NoNewline
$nsisOutput = Join-Path $root 'src-tauri\target\release\bundle\nsis'
if (Test-Path $nsisOutput) {
    Write-Host " OK" -ForegroundColor Green
    $installers = Get-ChildItem $nsisOutput -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 3
    if ($installers) {
        Write-Host "  Recent installers:" -ForegroundColor Cyan
        foreach ($installer in $installers) {
            Write-Host "    - $($installer.Name) ($(($installer.Length/1MB).ToString('0.00')) MB) - $($installer.LastWriteTime)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  - No installers found" -ForegroundColor Yellow
    }
} else {
    Write-Host " NOT FOUND" -ForegroundColor Yellow
    Write-Host "  No NSIS output directory found. Build hasn't run yet?" -ForegroundColor Gray
}
Write-Host ""

# Summary and recommendations
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Summary & Recommendations" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

$issues = @()

if (!(Test-Path $nsisScript)) {
    $issues += "Custom NSIS script is missing"
}

if (Test-Path $tauriWinConf) {
    $winConf = Get-Content $tauriWinConf -Raw | ConvertFrom-Json
    if (!$winConf.bundle.windows.nsis.template) {
        $issues += "Windows config doesn't reference custom NSIS template"
    }
} else {
    $issues += "Windows config file is missing"
}

if (!$makensis) {
    $issues += "NSIS compiler not found"
}

if ($issues.Count -eq 0) {
    Write-Host "All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If you still see the old interface, try:" -ForegroundColor Cyan
    Write-Host "  1. Delete the old build output:" -ForegroundColor Gray
    Write-Host "     Remove-Item '$nsisOutput' -Recurse -Force" -ForegroundColor Gray
    Write-Host "  2. Rebuild:" -ForegroundColor Gray
    Write-Host "     npm run tauri-build-win" -ForegroundColor Gray
} else {
    Write-Host "Issues found:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Yellow
    }
}
Write-Host ""
