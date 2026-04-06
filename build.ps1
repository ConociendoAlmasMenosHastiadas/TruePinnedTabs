#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the True Pinned Tabs Firefox extension as an XPI file.

.DESCRIPTION
    Packages the contents of the src/ directory into a .xpi file (which is
    just a ZIP under a different extension). No external tools or npm required.

.EXAMPLE
    .\build.ps1
    Produces: artifacts\true_pinned_tabs-1.0.0.xpi

.EXAMPLE
    .\build.ps1 -Version "1.2.0"
    Produces: artifacts\true_pinned_tabs-1.2.0.xpi
#>

param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$root      = $PSScriptRoot
$srcDir    = Join-Path $root "src"
$artifacts = Join-Path $root "artifacts"
$xpiName   = "true_pinned_tabs-$Version.xpi"
$xpiPath   = Join-Path $artifacts $xpiName

# ── Validate source ───────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $srcDir "manifest.json"))) {
    Write-Error "src\manifest.json not found. Run this script from the repo root."
}

# ── Prepare output directory ─────────────────────────────────────────────────
if (-not (Test-Path $artifacts)) {
    New-Item -ItemType Directory -Path $artifacts | Out-Null
}

# Remove any previous build of the same version so Compress-Archive doesn't append
if (Test-Path $xpiPath) { Remove-Item $xpiPath -Force }

# ── Build ─────────────────────────────────────────────────────────────────────
# We use .NET's ZipArchive directly instead of Compress-Archive because
# Compress-Archive on Windows stores entry names with backslashes, but the ZIP
# spec requires forward slashes and Firefox's JAR reader won't find files
# otherwise (icons, etc. simply fail to load).
Add-Type -AssemblyName System.IO.Compression.FileSystem

$stream = [System.IO.File]::Open($xpiPath, [System.IO.FileMode]::Create)
$zip    = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    Get-ChildItem -Path $srcDir -Recurse -File | ForEach-Object {
        # Build a forward-slash entry name relative to src/
        $entryName = $_.FullName.Substring($srcDir.Length).TrimStart('\', '/').Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName) | Out-Null
    }
} finally {
    $zip.Dispose()
    $stream.Dispose()
}

Write-Host "Built: $xpiPath" -ForegroundColor Green
Write-Host ""
Write-Host "To install permanently (Firefox Developer Edition / Nightly only):" -ForegroundColor Cyan
Write-Host "  1. Open about:config  ->  set xpinstall.signatures.required = false"
Write-Host "  2. Open about:addons  ->  gear icon  ->  Install Add-on From File"
Write-Host "  3. Select: $xpiPath"
