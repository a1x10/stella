# Stella Coder - Full Installer (Pure PowerShell)
$ErrorActionPreference = "Stop"
$nodeVer = "v22.14.0"
$nodeDir = "$env:USERPROFILE\StellaNode"
$nodePath = "$nodeDir\node-$nodeVer-win-x64"

Write-Host ""
Write-Host "  ===================================" -ForegroundColor Green
Write-Host "   Stella Coder - Full Installer" -ForegroundColor Green
Write-Host "  ===================================" -ForegroundColor Green
Write-Host ""

# Step 1: Set execution policy
Write-Host "  [1/5] Setting execution policy..." -ForegroundColor Yellow
try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction Stop
} catch {
    # Policy already set at Machine level, that's fine
}
Write-Host "  [OK] Execution policy ready" -ForegroundColor Green

# Step 2: Download Node.js
Write-Host "  [2/5] Downloading Node.js $nodeVer..." -ForegroundColor Yellow
if (Test-Path "$nodePath\node.exe") {
    Write-Host "  [OK] Node.js already installed" -ForegroundColor Green
} else {
    $zipUrl = "https://nodejs.org/dist/$nodeVer/node-$nodeVer-win-x64.zip"
    $zipFile = "$env:TEMP\node.zip"
    Write-Host "  Downloading from $zipUrl..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "  Extracting..."
    if (-not (Test-Path $nodeDir)) { New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null }
    Expand-Archive -Path $zipFile -DestinationPath $nodeDir -Force
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Node.js installed" -ForegroundColor Green
}

# Step 3: Add to PATH
Write-Host "  [3/5] Adding Node.js to PATH..." -ForegroundColor Yellow
$env:PATH = "$nodePath;$env:PATH"
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*StellaNode*") {
    [Environment]::SetEnvironmentVariable("PATH", "$nodePath;$currentPath", "User")
}
Write-Host "  [OK] PATH updated" -ForegroundColor Green

# Step 4: Install stella-coder
Write-Host "  [4/5] Installing stella-coder..." -ForegroundColor Yellow
& "$nodePath\node.exe" "$nodePath\node_modules\npm\bin\npm-cli.js" install -g stella-coder
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] npm install failed" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  [OK] stella-coder installed" -ForegroundColor Green

# Remove .ps1 wrapper so PowerShell uses .cmd instead
$stellaPs1 = "$nodePath\stella.ps1"
if (Test-Path $stellaPs1) { 
    Remove-Item $stellaPs1 -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Removed stella.ps1 wrapper (use stella.cmd)" -ForegroundColor Green
}

# Step 5: Create desktop shortcut
Write-Host "  [5/5] Creating desktop shortcut..." -ForegroundColor Yellow
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Stella Coder.lnk")
$shortcut.TargetPath = "$nodePath\node.exe"
$shortcut.Arguments = "`"$nodePath\node_modules\stella-coder\stella-cli\index.mjs`""
$shortcut.WorkingDirectory = $env:USERPROFILE
$shortcut.Save()
Write-Host "  [OK] Shortcut created" -ForegroundColor Green

Write-Host ""
Write-Host "  ===================================" -ForegroundColor Green
Write-Host "   DONE!" -ForegroundColor Green
Write-Host "  ===================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Launch: stella" -ForegroundColor Cyan
Write-Host "  Or double-click 'Stella Coder' on Desktop" -ForegroundColor Cyan
Write-Host ""

# Launch stella
& "$nodePath\stella.cmd"
