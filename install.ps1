# Stella installer — downloads, sets up and launches Stella.
# Usage (one line in PowerShell):
#   irm https://github.com/a1x10/stella/releases/latest/download/install.ps1 | iex
$ErrorActionPreference = 'Stop'

$dir = Join-Path $env:LOCALAPPDATA 'Stella'
$exe = Join-Path $dir 'stella.exe'
$url = 'https://github.com/a1x10/stella/releases/latest/download/stella.exe'

Write-Host ''
Write-Host '  Installing Stella...' -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Write-Host '  Downloading (~136 MB), this can take a minute...' -ForegroundColor DarkGray
Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing

# Remove "downloaded from internet" mark so it runs without SmartScreen friction
try { Unblock-File -Path $exe -ErrorAction Stop } catch {}

# Add install dir to the user's PATH (so `stella` works in any new terminal)
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
if ($userPath -notlike "*$dir*") {
  [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $dir), 'User')
}
# Make it available in the current session too
if ($env:Path -notlike "*$dir*") { $env:Path = "$env:Path;$dir" }

Write-Host ''
Write-Host '  Stella installed!' -ForegroundColor Green
Write-Host '  Type ' -NoNewline; Write-Host 'stella' -ForegroundColor Yellow -NoNewline; Write-Host ' anytime to launch it.'
Write-Host '  Launching now...' -ForegroundColor DarkGray
Write-Host ''

& $exe @args
