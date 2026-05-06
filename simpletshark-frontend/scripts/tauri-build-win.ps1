Param(
  [Parameter(Position=0)]
  [string]$Target = "nsis",
  [switch]$VerboseLog
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host $msg -ForegroundColor Green }

function Resolve-CommandPath {
  param(
    [string]$CommandName,
    [string[]]$Fallbacks = @()
  )

  $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  foreach ($path in $Fallbacks) {
    if ($path -and (Test-Path -LiteralPath $path)) {
      return $path
    }
  }

  return $null
}

function Import-VsDevEnvironment {
  if (Get-Command link.exe -ErrorAction SilentlyContinue) {
    return
  }

  $vswhereCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
    "${env:ProgramFiles}\Microsoft Visual Studio\Installer\vswhere.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  $vcvarsCandidates = New-Object System.Collections.Generic.List[string]

  foreach ($vswhere in $vswhereCandidates) {
    try {
      $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
      if ($installPath) {
        $vcvarsCandidates.Add((Join-Path $installPath 'VC\Auxiliary\Build\vcvars64.bat'))
      }
    } catch {}
  }

  $drives = @($env:SystemDrive, 'C:', 'D:')
  $versions = @('18', '2022', '17', '2019')
  $editions = @('Enterprise', 'Professional', 'Community', 'BuildTools')
  foreach ($drive in ($drives | Where-Object { $_ } | Select-Object -Unique)) {
    foreach ($version in $versions) {
      foreach ($edition in $editions) {
        $vcvarsCandidates.Add((Join-Path "${drive}\Program Files\Microsoft Visual Studio\$version\$edition" 'VC\Auxiliary\Build\vcvars64.bat'))
        $vcvarsCandidates.Add((Join-Path "${drive}\Program Files (x86)\Microsoft Visual Studio\$version\$edition" 'VC\Auxiliary\Build\vcvars64.bat'))
      }
    }
  }

  $vcvarsPath = $vcvarsCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $vcvarsPath) {
    throw "MSVC build environment not found. Install Visual Studio Build Tools with the 'Desktop development with C++' workload."
  }

  Write-Info "Loading MSVC environment from: $vcvarsPath"
  $envDump = & cmd.exe /d /c "call `"$vcvarsPath`" >nul && set"
  foreach ($line in $envDump) {
    if ($line -match '^(.*?)=(.*)$') {
      [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
  }

  if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    throw "MSVC environment was loaded, but link.exe is still unavailable."
  }
}

function Sync-Version {
  Write-Step "[2/5] Sync version..."
  $root = Join-Path $PSScriptRoot '..'
  $pkgPath = Join-Path $root 'package.json'
  $cargoPath = Join-Path $root 'src-tauri/Cargo.toml'
  $tauriConfPath = Join-Path $root 'src-tauri/tauri.conf.json'

  if (!(Test-Path $pkgPath)) { throw "Missing package.json: $pkgPath" }
  if (!(Test-Path $cargoPath)) { throw "Missing Cargo.toml: $cargoPath" }
  if (!(Test-Path $tauriConfPath)) { throw "Missing tauri.conf.json: $tauriConfPath" }

  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  $version = $pkg.version
  if ([string]::IsNullOrWhiteSpace($version)) { throw "Version not found in package.json" }

  $cargo = Get-Content $cargoPath -Raw
  $pattern = '^version\s*=\s*"[^"]*"'
  $replacement = "version = `"$version`""
  $cargo = [System.Text.RegularExpressions.Regex]::Replace(
    $cargo,
    $pattern,
    $replacement,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($cargoPath, $cargo, $utf8NoBom)

  $tauriConfJson = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
  $tauriConfJson.version = $version
  $tauriFormatted = ($tauriConfJson | ConvertTo-Json -Depth 100)
  [System.IO.File]::WriteAllText($tauriConfPath, $tauriFormatted, $utf8NoBom)

  Write-Info "Synced version: $version"
}

function Prepare-Resources {
  Write-Step "[3/5] Prepare Windows resources..."
  $root = Join-Path $PSScriptRoot '..'
  $srcDir = Join-Path $root 'resources/tshark_win'
  $dstDir = Join-Path $root 'src-tauri'

  if (!(Test-Path $srcDir)) { throw "Resource directory not found: $srcDir" }

  foreach ($p in @('tshark_server', 'tshark_server.exe', 'tshark_server_helper.exe', 'tshark_fields.db')) {
    $target = Join-Path $dstDir $p
    if (Test-Path $target) { Remove-Item -Force $target -Recurse -ErrorAction SilentlyContinue }
  }
  $tsharkDir = Join-Path $dstDir 'tshark'
  if (Test-Path $tsharkDir) { Remove-Item -Force $tsharkDir -Recurse -ErrorAction SilentlyContinue }

  Copy-Item -Path (Join-Path $srcDir '*') -Destination $dstDir -Recurse -Force
  Write-Info "Resources copied to src-tauri/"
}

function Build-Tauri {
  param([string]$BuildTarget = "app")

  $targetName = if ($BuildTarget -eq "nsis") { "NSIS Installer" } else { "App Only" }
  Write-Step "[4/5] Build Tauri ($targetName)..."
  $root = Join-Path $PSScriptRoot '..'
  $baseCfgPath = (Join-Path $root 'src-tauri/tauri.conf.json')
  $winCfgPath = (Join-Path $root 'src-tauri/tauri.windows.conf.json')
  if (!(Test-Path $baseCfgPath)) { throw "Base config not found: $baseCfgPath" }
  if (!(Test-Path $winCfgPath)) { throw "Windows config not found: $winCfgPath" }

  # Build merged config: start from base, overlay Windows bundle fields, keep frontendDist
  $baseCfg = Get-Content $baseCfgPath -Raw | ConvertFrom-Json
  $winCfg = Get-Content $winCfgPath -Raw | ConvertFrom-Json
  $merged = $baseCfg | ConvertTo-Json -Depth 100 | ConvertFrom-Json  # deep clone
  if ($winCfg.bundle) {
    if (-not $merged.bundle) { $merged | Add-Member -NotePropertyName bundle -NotePropertyValue (@{}) }
    if ($winCfg.bundle.targets) { $merged.bundle.targets = $winCfg.bundle.targets }
    if ($winCfg.bundle.windows) { $merged.bundle.windows = $winCfg.bundle.windows }
  }
  if (-not $merged.bundle) { $merged | Add-Member -NotePropertyName bundle -NotePropertyValue (@{}) }
  # Add or update targets property
  if ($merged.bundle.PSObject.Properties.Name -contains 'targets') {
    $merged.bundle.targets = @($BuildTarget)
  } else {
    $merged.bundle | Add-Member -NotePropertyName targets -NotePropertyValue @($BuildTarget)
  }

  # Optional hardening: ensure we have a frontendDist and do not rely on devUrl
  if (-not $merged.build -or -not $merged.build.frontendDist) {
    throw "Missing build.frontendDist in config. Set it to your built frontend directory (e.g. ../build)."
  }
  # Make frontendDist absolute because TAURI_CONFIG_PATH points to a temp file
  $srcTauriDir = Join-Path $root 'src-tauri'
  $fd = [string]$merged.build.frontendDist
  if (-not [System.IO.Path]::IsPathRooted($fd)) {
    $fdAbs = Join-Path $srcTauriDir $fd
  } else {
    $fdAbs = $fd
  }
  try { $fdAbs = (Resolve-Path $fdAbs).Path } catch {}
  $merged.build.frontendDist = $fdAbs
  # Remove devUrl to ensure packaged app does not attempt to load a dev server
  if ($merged.build -and ($merged.build.PSObject.Properties.Name -contains 'devUrl')) {
    [void]$merged.build.PSObject.Properties.Remove('devUrl')
  }
  # Validate frontend dist contains index.html
  $indexHtml = Join-Path $fdAbs 'index.html'
  if (!(Test-Path $indexHtml)) {
    throw "Frontend dist missing index.html at: $indexHtml. Ensure 'npm run build' produced the SPA assets."
  }

  # Write merged config to a temporary file and point TAURI_CONFIG_PATH to it for deterministic builds
  $tmpCfg = Join-Path $root 'src-tauri/.tauri.windows.merged.json'
  $mergedJson = ($merged | ConvertTo-Json -Depth 100)
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmpCfg, $mergedJson, $utf8NoBom)
  $env:TAURI_CONFIG_PATH = $tmpCfg
  if (Test-Path Env:TAURI_CONFIG) { Remove-Item Env:TAURI_CONFIG -ErrorAction SilentlyContinue }

  # Try to locate NSIS (makensis) in common install paths and add to PATH
  $pf = $env:ProgramFiles
  $pfx86 = ${env:ProgramFiles(x86)}
  $choco = $env:ChocolateyInstall
  $candidates = @()
  if ($pf)   { $candidates += @("$pf\NSIS\makensis.exe", "$pf\NSIS\Bin\makensis.exe") }
  if ($pfx86){ $candidates += @("$pfx86\NSIS\makensis.exe", "$pfx86\NSIS\Bin\makensis.exe") }
  if ($choco){ $candidates += @("$choco\bin\makensis.exe", "$choco\lib\nsis\tools\makensis.exe") }
  foreach ($exe in $candidates) {
    if (Test-Path -LiteralPath $exe) {
      $dir = Split-Path -Path $exe -Parent
      if (-not (($env:Path -split ';') -contains $dir)) { $env:Path = "$dir;$env:Path" }
      break
    }
  }

  $makensis = Get-Command makensis -ErrorAction SilentlyContinue
  if (-not $makensis) {
    throw "NSIS (makensis) not found. Install with 'winget install NSIS.NSIS' or download from https://nsis.sourceforge.io/Download"
  }

  # Prefer cargo-installed tauri-cli to avoid npx downloading from GitHub
  $cargoPath = Resolve-CommandPath 'cargo' @(
    (Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe')
  )
  $useCargo = $false
  if ($cargoPath) {
    try {
      & $cargoPath tauri --version >$null 2>&1
      if ($LASTEXITCODE -eq 0) { $useCargo = $true }
    } catch {}
  }

  # For app target, skip tauri bundler entirely and use cargo build directly
  # This avoids unwanted MSI/other installers being created
  if ($BuildTarget -eq "app") {
    Write-Info "Building with cargo (skipping Tauri bundler to avoid MSI generation)..."
    $cargo = (Get-Command cargo -ErrorAction SilentlyContinue).Source
    if (-not $cargo) { throw "cargo not found." }
    Push-Location (Join-Path $root 'src-tauri')
    try {
      $env:RUST_BACKTRACE = 'full'
      & $cargo build --release -v
      $code = $LASTEXITCODE
      if ($code -ne 0) { throw "cargo build failed, exit code: $code" }
    } finally { Pop-Location }
  } else {
    # For NSIS target, we need tauri build to setup bundler infrastructure
    $env:RUST_LOG = 'tauri_bundler=debug,tauri=info'

    if ($useCargo) {
      $cmdPath = $cargoPath
      $args = @('tauri', 'build', '--verbose')
    } else {
      # Prefer project-local tauri CLI to avoid npx/environment inconsistencies
      $localTauri = Join-Path $root 'node_modules\.bin\tauri.cmd'
      if (Test-Path $localTauri) {
        $cmdPath = $localTauri
        $args = @('build', '--verbose')
      } else {
        # Fallback to npx if local tauri CLI is unavailable
        $cmdPath = Resolve-CommandPath 'npx' @(
          (Join-Path $env:ProgramFiles 'nodejs\npx.cmd'),
          (Join-Path ${env:ProgramFiles(x86)} 'nodejs\npx.cmd')
        )
        if (-not $cmdPath) {
          throw "Neither 'cargo tauri', local 'node_modules/.bin/tauri.cmd', nor 'npx' was found. Install tauri-cli via 'cargo install tauri-cli --version 2' or install Node.js."
        }
        $args = @('tauri', 'build', '--verbose')
      }
    }

    Push-Location $root
    try {
      & $cmdPath @args
      $code = $LASTEXITCODE
      if ($code -ne 0) {
        Write-Warning "tauri build failed (exit $code). Falling back to cargo build --release."
        # Fallback: cargo build release directly
        $cargo = (Get-Command cargo -ErrorAction SilentlyContinue).Source
        if (-not $cargo) { throw "cargo not found for fallback build." }
        Push-Location (Join-Path $root 'src-tauri')
        try {
          $env:RUST_BACKTRACE = 'full'
          & $cargo build --release -v
          $code2 = $LASTEXITCODE
          if ($code2 -ne 0) { throw "cargo build failed, exit code: $code2" }
        } finally { Pop-Location }
      }
    } finally {
      Pop-Location
    }

    $mainExe = Get-ChildItem $relTarget -Filter *.exe -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notmatch 'helper' -and $_.Name -notmatch 'server' } |
      Sort-Object Length -Descending | Select-Object -First 1

    if (-not $mainExe) {
      Write-Warning "No main exe was produced in target/release after Tauri build. Falling back to cargo build --release for a clearer failure."
      $cargo = Resolve-CommandPath 'cargo' @(
        (Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe')
      )
      if (-not $cargo) { throw "cargo not found for fallback build." }
      Push-Location (Join-Path $root 'src-tauri')
      try {
        $env:RUST_BACKTRACE = 'full'
        & $cargo build --release -v
        $code3 = $LASTEXITCODE
        if ($code3 -ne 0) { throw "cargo build failed, exit code: $code3" }
      } finally { Pop-Location }
    }
  }

  if ($BuildTarget -eq "app") {
    Write-Info "Tauri build complete. Creating correct app bundle from release..."
    Build-AppBundle
  } else {
    Write-Info "Tauri build complete. Building NSIS installer..."
    Build-CustomNSIS
  }
}

function Cleanup-Resources {
  Write-Step "[5/5] Cleanup temporary resources..."
  $root = Join-Path $PSScriptRoot '..'
  $dstDir = Join-Path $root 'src-tauri'
  foreach ($p in @('tshark_server', 'tshark_server.exe', 'tshark_server_helper.exe', 'tshark_fields.db')) {
    $target = Join-Path $dstDir $p
    if (Test-Path $target) { Remove-Item -Force $target -Recurse -ErrorAction SilentlyContinue }
  }
  $tsharkDir = Join-Path $dstDir 'tshark'
  if (Test-Path $tsharkDir) { Remove-Item -Force $tsharkDir -Recurse -ErrorAction SilentlyContinue }
  $tmpCfg = Join-Path $dstDir '.tauri.windows.merged.json'
  if (Test-Path $tmpCfg) { Remove-Item -Force $tmpCfg -ErrorAction SilentlyContinue }
  # Clean NSIS staging directory
  $nsisStaging = Join-Path $root 'src-tauri/target/release/bundle/nsis-staging'
  if (Test-Path $nsisStaging) { Remove-Item -Force $nsisStaging -Recurse -ErrorAction SilentlyContinue }
  Write-Info "Temporary resources cleaned."
}

function Build-AppBundle {
  Write-Step "[4/5-a] Build app bundle from release..."
  $root = Join-Path $PSScriptRoot '..'
  $bundleDir = Join-Path $root 'src-tauri/target/release/bundle'
  $relTarget = Join-Path $root 'src-tauri/target/release'
  if (!(Test-Path $relTarget)) { throw "Release target dir not found: $relTarget" }

  # Remove old bundle/app and create fresh one from release
  $appDir = Join-Path $bundleDir 'app'
  if (Test-Path $appDir) { Remove-Item -Force $appDir -Recurse -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $appDir | Out-Null

  Write-Info "Creating app bundle from release directory..."
  # Copy main exes and dlls from release
  Copy-Item -Path (Join-Path $relTarget '*.exe') -Destination $appDir -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $relTarget '*.dll') -Destination $appDir -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $relTarget '*.db') -Destination $appDir -Force -ErrorAction SilentlyContinue

  # Include runtime resources from src-tauri root that app expects
  foreach ($p in @('tshark_server', 'tshark_server.exe', 'tshark_server_helper.exe', 'tshark_fields.db')) {
    $srcP = Join-Path (Join-Path $root 'src-tauri') $p
    if (Test-Path $srcP) { Copy-Item -Path $srcP -Destination $appDir -Recurse -Force }
  }
  $srcDir2 = Join-Path (Join-Path $root 'src-tauri') 'tshark'
  if (Test-Path $srcDir2) { Copy-Item -Path $srcDir2 -Destination (Join-Path $appDir 'tshark') -Recurse -Force }

  Write-Info "App bundle complete. Output in src-tauri/target/release/bundle/app/"
}

function Build-CustomNSIS {
  Write-Step "[4/5-b] Build NSIS installer (custom)..."
  $root = Join-Path $PSScriptRoot '..'
  $bundleDir = Join-Path $root 'src-tauri/target/release/bundle'
  $relTarget = Join-Path $root 'src-tauri/target/release'
  if (!(Test-Path $relTarget)) { throw "Release target dir not found: $relTarget" }

  # Always create fresh staging directory from release (not bundle/app)
  $staging = Join-Path $bundleDir 'nsis-staging'
  if (Test-Path $staging) { Remove-Item -Force $staging -Recurse -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $staging | Out-Null

  Write-Info "Creating NSIS staging from release directory..."
  # Copy main exes and dlls from release
  Copy-Item -Path (Join-Path $relTarget '*.exe') -Destination $staging -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $relTarget '*.dll') -Destination $staging -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $relTarget '*.db') -Destination $staging -Force -ErrorAction SilentlyContinue

  # Include runtime resources from src-tauri root that app expects
  foreach ($p in @('tshark_server', 'tshark_server.exe', 'tshark_server_helper.exe', 'tshark_fields.db')) {
    $srcP = Join-Path (Join-Path $root 'src-tauri') $p
    if (Test-Path $srcP) { Copy-Item -Path $srcP -Destination $staging -Recurse -Force }
  }
  $srcDir2 = Join-Path (Join-Path $root 'src-tauri') 'tshark'
  if (Test-Path $srcDir2) { Copy-Item -Path $srcDir2 -Destination (Join-Path $staging 'tshark') -Recurse -Force }

  $appDir = $staging

  $cfgPath = Join-Path $root 'src-tauri/tauri.conf.json'
  $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
  $appName = $cfg.productName
  $version = $cfg.version

  $exe = Get-ChildItem $appDir -Filter *.exe -File -Recurse |
    Where-Object { $_.Name -notmatch 'helper' -and $_.Name -notmatch 'server' } |
    Sort-Object Length -Descending | Select-Object -First 1
  if (-not $exe) { throw "Could not find main exe in $appDir" }
  $exeName = $exe.Name

  $nsisScriptCandidates = @(
    (Join-Path $root 'scripts/nsis/simpletshark.nsi'),
    (Join-Path $root 'scripts/nsis/easytshark.nsi')
  )
  $nsisScript = $nsisScriptCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $nsisScript) {
    throw "NSIS script not found. Checked: $($nsisScriptCandidates -join ', ')"
  }

  $outDir = Join-Path $bundleDir 'nsis'
  if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

  # Generate timestamp for installer filename (like macOS DMG: YYYYMMDDHHmmss)
  $timestamp = Get-Date -Format "yyyyMMddHHmmss"
  $installerName = "${appName}_${version}_${timestamp}_setup.exe"

  $defines = @(
    "/DAPP_NAME=$appName",
    "/DAPP_VERSION=$version",
    "/DAPP_SRC=$appDir",
    "/DEXE_NAME=$exeName",
    "/DOUTPUT_DIR=$outDir",
    "/DINSTALLER_NAME=$installerName"
  )

  $makensis = Get-Command makensis -ErrorAction SilentlyContinue
  if (-not $makensis) { throw "NSIS (makensis) not found in PATH." }

  & $makensis.Source @defines $nsisScript
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "NSIS packaging failed, exit code: $code" }

  Write-Info "Installer complete: $outDir\$installerName"
}

function Build-Frontend {
  Write-Step "[1/5] Build frontend (React)..."
  $root = Join-Path $PSScriptRoot '..'
  Push-Location $root
  try {
    $npmPath = Resolve-CommandPath 'npm' @(
      (Join-Path $env:ProgramFiles 'nodejs\npm.cmd'),
      (Join-Path ${env:ProgramFiles(x86)} 'nodejs\npm.cmd'),
      (Join-Path $env:APPDATA 'npm\npm.cmd')
    )
    if (-not $npmPath) {
      throw "npm not found. Please install Node.js."
    }

    Write-Info "Running: npm run build"
    & $npmPath run build
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      throw "Frontend build failed, exit code: $code"
    }

    # Verify build output
    $buildDir = Join-Path $root 'build'
    $indexHtml = Join-Path $buildDir 'index.html'
    if (!(Test-Path $indexHtml)) {
      throw "Frontend build did not produce index.html at: $buildDir"
    }

    Write-Info "Frontend build complete!"
  } finally {
    Pop-Location
  }
}

try {
  $buildType = if ($Target -eq "nsis") { "NSIS Installer" } else { "App Bundle" }
  Write-Host "======================================" -ForegroundColor Yellow
  Write-Host "  Tauri Windows Build ($buildType)" -ForegroundColor Yellow
  Write-Host "======================================" -ForegroundColor Yellow

  Import-VsDevEnvironment
  Build-Frontend
  Sync-Version
  Prepare-Resources
  Build-Tauri -BuildTarget $Target
} finally {
  Cleanup-Resources
}
