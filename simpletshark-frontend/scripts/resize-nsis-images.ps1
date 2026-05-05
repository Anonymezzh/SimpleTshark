# NSIS Image Resize Script
# Automatically resize images to the correct dimensions for NSIS installer

$ErrorActionPreference = 'Stop'

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  NSIS Image Resize Tool" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$root = Join-Path $PSScriptRoot '..'
$imagesDir = Join-Path $root 'scripts\nsis\images'

# Required dimensions
$wizardWidth = 164
$wizardHeight = 314
$headerWidth = 150
$headerHeight = 57

# Image files
$wizardSource = Join-Path $imagesDir 'wizard-original.bmp'
$wizardSourcePng = Join-Path $imagesDir 'wizard-original.png'
$wizardSourceJpg = Join-Path $imagesDir 'wizard-original.jpg'
$wizardTarget = Join-Path $imagesDir 'wizard.bmp'

$headerSource = Join-Path $imagesDir 'header-original.bmp'
$headerSourcePng = Join-Path $imagesDir 'header-original.png'
$headerSourceJpg = Join-Path $imagesDir 'header-original.jpg'
$headerTarget = Join-Path $imagesDir 'header.bmp'

# Function to find source image (check multiple formats)
function Find-SourceImage($basePath) {
    $extensions = @('.bmp', '.png', '.jpg', '.jpeg')
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($basePath)
    $dir = [System.IO.Path]::GetDirectoryName($basePath)

    foreach ($ext in $extensions) {
        $testPath = Join-Path $dir "$baseName$ext"
        if (Test-Path $testPath) {
            return $testPath
        }
    }
    return $null
}

# Function to resize image using .NET
function Resize-Image($sourcePath, $targetPath, $width, $height) {
    Write-Host "  Resizing: $(Split-Path $sourcePath -Leaf) -> $(Split-Path $targetPath -Leaf)" -ForegroundColor Yellow
    Write-Host "  Target size: ${width}x${height}" -ForegroundColor Gray

    Add-Type -AssemblyName System.Drawing

    try {
        # Load source image
        $img = [System.Drawing.Image]::FromFile($sourcePath)
        Write-Host "  Source size: $($img.Width)x$($img.Height)" -ForegroundColor Gray

        # Create bitmap with target size
        $bitmap = New-Object System.Drawing.Bitmap($width, $height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

        # High quality resize
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        # Draw resized image
        $graphics.DrawImage($img, 0, 0, $width, $height)

        # Save as BMP
        $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

        $graphics.Dispose()
        $bitmap.Dispose()
        $img.Dispose()

        Write-Host "  Success!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "  Error: $_" -ForegroundColor Red
        return $false
    }
}

# Check if images directory exists
if (!(Test-Path $imagesDir)) {
    Write-Host "Creating images directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $imagesDir | Out-Null
}

$resizedCount = 0

# Process wizard image
Write-Host "[1/2] Processing wizard image (sidebar)..." -ForegroundColor Cyan
$wizardSrc = Find-SourceImage $wizardSource
if (!$wizardSrc) { $wizardSrc = Find-SourceImage $wizardSourcePng }
if (!$wizardSrc) { $wizardSrc = Find-SourceImage $wizardSourceJpg }

if ($wizardSrc) {
    if (Resize-Image $wizardSrc $wizardTarget $wizardWidth $wizardHeight) {
        $resizedCount++
    }
}
else {
    Write-Host "  No source image found. Looking for:" -ForegroundColor Yellow
    Write-Host "    - wizard-original.bmp/.png/.jpg" -ForegroundColor Gray
    Write-Host "  Please add your source image to: $imagesDir" -ForegroundColor Yellow
}
Write-Host ""

# Process header image
Write-Host "[2/2] Processing header image (top banner)..." -ForegroundColor Cyan
$headerSrc = Find-SourceImage $headerSource
if (!$headerSrc) { $headerSrc = Find-SourceImage $headerSourcePng }
if (!$headerSrc) { $headerSrc = Find-SourceImage $headerSourceJpg }

if ($headerSrc) {
    if (Resize-Image $headerSrc $headerTarget $headerWidth $headerHeight) {
        $resizedCount++
    }
}
else {
    Write-Host "  No source image found. Looking for:" -ForegroundColor Yellow
    Write-Host "    - header-original.bmp/.png/.jpg" -ForegroundColor Gray
    Write-Host "  Please add your source image to: $imagesDir" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if ($resizedCount -gt 0) {
    Write-Host "Successfully resized $resizedCount image(s)!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output files:" -ForegroundColor Cyan
    if (Test-Path $wizardTarget) {
        Write-Host "  - $wizardTarget (${wizardWidth}x${wizardHeight})" -ForegroundColor Green
    }
    if (Test-Path $headerTarget) {
        Write-Host "  - $headerTarget (${headerWidth}x${headerHeight})" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "You can now run: npm run tauri-build-win" -ForegroundColor Yellow
}
else {
    Write-Host "No images were resized." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To use custom images:" -ForegroundColor Cyan
    Write-Host "  1. Add your source images to: $imagesDir" -ForegroundColor Gray
    Write-Host "     - wizard-original.png (any size, will be resized to ${wizardWidth}x${wizardHeight})" -ForegroundColor Gray
    Write-Host "     - header-original.png (any size, will be resized to ${headerWidth}x${headerHeight})" -ForegroundColor Gray
    Write-Host "  2. Run this script again: .\scripts\resize-nsis-images.ps1" -ForegroundColor Gray
    Write-Host "  3. Build installer: npm run tauri-build-win" -ForegroundColor Gray
}
Write-Host ""
