# Stella installer (Windows)
# Usage:  irm https://raw.githubusercontent.com/a1x10/stella/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo      = "a1x10/stella"
$InstallDir = Join-Path $env:USERPROFILE ".stella\bin"
$Asset     = "stella-windows-x64.zip"
$Url       = "https://github.com/$Repo/releases/latest/download/$Asset"

Write-Host ""
Write-Host "Installing Stella..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$tmp = Join-Path $env:TEMP ("stella-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp $Asset

try {
    Write-Host "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $InstallDir -Force
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

# Ensure the binary is named stella.exe
$exe = Join-Path $InstallDir "stella.exe"
if (-not (Test-Path $exe)) {
    $found = Get-ChildItem $InstallDir -Filter *.exe | Select-Object -First 1
    if ($found) { Move-Item -Force $found.FullName $exe }
}

# Add install dir to the user PATH (persistent) if missing
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (($userPath -split ';') -notcontains $InstallDir) {
    $newPath = if ([string]::IsNullOrEmpty($userPath)) { $InstallDir } else { "$userPath;$InstallDir" }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "Added $InstallDir to your PATH."
}

Write-Host ""
Write-Host "Stella installed!" -ForegroundColor Green
Write-Host "Open a NEW terminal window and run:  stella" -ForegroundColor Yellow
Write-Host ""
