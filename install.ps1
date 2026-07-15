# Stella Coder — установка в ОДНУ команду (модель Claude Code, без npm-реестра)
# ------------------------------------------------------------
# Покупателю достаточно вставить в PowerShell:
#
#   irm https://raw.githubusercontent.com/a1x10/stella/master/install.ps1 | iex
#
# Скачивается готовый бандл напрямую с GitHub (никакого `npm install`,
# логина в npm и прав администратора не нужно). После установки команда
# `stella` работает из ЛЮБОГО терминала: PowerShell, CMD, Git Bash, WT.
# ------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$NodeVer   = 'v22.14.0'
$Base      = "$env:LOCALAPPDATA\StellaCoder"
$BinDir    = "$Base\bin"
$BundleUrl = 'https://raw.githubusercontent.com/a1x10/stella/master/dist/stella.mjs'

# Добавить папку в постоянный User PATH + в текущую сессию
function Add-UserPath([string]$dir) {
    if ([string]::IsNullOrWhiteSpace($dir)) { return }
    $dir = $dir.TrimEnd('\')
    $cur = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @()
    if ($cur) { $parts = $cur -split ';' | Where-Object { $_ -ne '' } }
    if ($parts -notcontains $dir) {
        [Environment]::SetEnvironmentVariable('Path', ((@($dir) + $parts) -join ';'), 'User')
    }
    if (($env:Path -split ';') -notcontains $dir) { $env:Path = "$dir;$env:Path" }
}

Write-Host ''
Write-Host '  ==============================' -ForegroundColor Magenta
Write-Host '   Stella Coder — установка' -ForegroundColor Magenta
Write-Host '  ==============================' -ForegroundColor Magenta
Write-Host ''

# [0] Разрешить запуск скриптов для текущего пользователя
try { Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction Stop } catch {}

New-Item -ItemType Directory -Path $BinDir -Force | Out-Null

# [1] Node.js — системный, иначе портативный в профиль
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $NodeExe = $nodeCmd.Source
    Write-Host "  [1/3] Node.js найден: $(node -v)" -ForegroundColor Green
} else {
    Write-Host '  [1/3] Node.js не найден — скачиваю портативную версию...' -ForegroundColor Yellow
    $nodePath = "$Base\node\node-$NodeVer-win-x64"
    if (-not (Test-Path "$nodePath\node.exe")) {
        $zip = "$env:TEMP\stella-node.zip"
        Invoke-WebRequest -Uri "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip" -OutFile $zip -UseBasicParsing
        New-Item -ItemType Directory -Path "$Base\node" -Force | Out-Null
        Expand-Archive -Path $zip -DestinationPath "$Base\node" -Force
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path "$nodePath\node.exe")) { throw 'Не удалось распаковать Node.js' }
    }
    $NodeExe = "$nodePath\node.exe"
    Add-UserPath $nodePath
    Write-Host "  [OK] Node.js установлен ($NodeVer)" -ForegroundColor Green
}

# [2] Скачиваем бандл Stella напрямую с GitHub
Write-Host '  [2/3] Скачиваю Stella Coder...' -ForegroundColor Yellow
Invoke-WebRequest -Uri $BundleUrl -OutFile "$Base\stella.mjs" -UseBasicParsing
if (-not (Test-Path "$Base\stella.mjs")) { throw 'Не удалось скачать stella.mjs' }
Write-Host '  [OK] Stella Coder загружена' -ForegroundColor Green

# [3] Создаём команду `stella` для всех терминалов
Write-Host '  [3/3] Привязываю команду stella ко всем терминалам...' -ForegroundColor Yellow

# Шим для CMD и PowerShell (абсолютный путь к node — работает всегда)
"@echo off`r`n`"$NodeExe`" `"%~dp0..\stella.mjs`" %*" |
    Set-Content -Path "$BinDir\stella.cmd" -Encoding ASCII

# Шим для Git Bash / MSYS
"#!/bin/sh`nexec node `"`$(dirname `"`$0`")/../stella.mjs`" `"`$@`"" |
    Set-Content -Path "$BinDir\stella" -Encoding ASCII -NoNewline

Add-UserPath $BinDir

# Ярлык на рабочий стол
try {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $ws  = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut("$desktop\Stella Coder.lnk")
    $lnk.TargetPath = 'cmd.exe'
    $lnk.Arguments  = '/k stella'
    $lnk.Description = 'Stella Coder CLI'
    $lnk.Save()
} catch {}

Write-Host '  [OK] stella доступна из PowerShell, CMD, Git Bash и Windows Terminal' -ForegroundColor Green

Write-Host ''
Write-Host '  Готово! ✓' -ForegroundColor Green
Write-Host ''
Write-Host '  Запуск:  ' -NoNewline; Write-Host 'stella' -ForegroundColor Cyan
Write-Host '  (в уже открытых окнах — перезапустите терминал)' -ForegroundColor DarkGray
Write-Host ''

# Запускаем сразу
try { & "$BinDir\stella.cmd" } catch { Write-Host '  Откройте новый терминал и введите: stella' -ForegroundColor Yellow }
