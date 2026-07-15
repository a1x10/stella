# Stella Coder — установка в ОДНУ команду
# ------------------------------------------------------------
# Покупателю достаточно вставить в PowerShell:
#
#   irm https://raw.githubusercontent.com/a1x10/stella/master/install.ps1 | iex
#
# После установки команда `stella` работает из ЛЮБОГО терминала
# (PowerShell, CMD, Git Bash, Windows Terminal) без прав администратора.
# ------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$NodeVer = 'v22.14.0'

# Добавить папку в постоянный User PATH + в текущую сессию
function Add-UserPath([string]$dir) {
    if ([string]::IsNullOrWhiteSpace($dir)) { return }
    $dir = $dir.TrimEnd('\')
    $cur = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @()
    if ($cur) { $parts = $cur -split ';' | Where-Object { $_ -ne '' } }
    if ($parts -notcontains $dir) {
        $new = (@($dir) + $parts) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $new, 'User')
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

# [1] Node.js — используем системный, иначе ставим портативный в профиль
$hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$hasNpm  = [bool](Get-Command npm  -ErrorAction SilentlyContinue)
if ($hasNode -and $hasNpm) {
    Write-Host "  [1/4] Node.js найден: $(node -v)" -ForegroundColor Green
} else {
    Write-Host '  [1/4] Node.js не найден — скачиваю портативную версию...' -ForegroundColor Yellow
    $nodeDir  = "$env:LOCALAPPDATA\StellaNode"
    $nodePath = "$nodeDir\node-$NodeVer-win-x64"
    if (-not (Test-Path "$nodePath\node.exe")) {
        $zip = "$env:TEMP\stella-node.zip"
        Invoke-WebRequest -Uri "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip" -OutFile $zip -UseBasicParsing
        if (-not (Test-Path $nodeDir)) { New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null }
        Expand-Archive -Path $zip -DestinationPath $nodeDir -Force
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path "$nodePath\node.exe")) { throw 'Не удалось распаковать Node.js' }
    }
    Add-UserPath $nodePath
    Write-Host "  [OK] Node.js установлен ($NodeVer)" -ForegroundColor Green
}

# [2] Ставим stella-coder глобально
Write-Host '  [2/4] Устанавливаю stella-coder...' -ForegroundColor Yellow
npm install -g stella-coder@latest --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw 'npm install -g stella-coder завершился с ошибкой' }
Write-Host '  [OK] stella-coder установлен' -ForegroundColor Green

# [3] Привязываем команду `stella` ко ВСЕМ терминалам
Write-Host '  [3/4] Привязываю команду stella ко всем терминалам...' -ForegroundColor Yellow
$prefix = (npm config get prefix).Trim()
Add-UserPath $prefix
# Убираем .ps1-обёртку, чтобы PowerShell всегда брал stella.cmd (без проблем с политикой запуска)
Remove-Item "$prefix\stella.ps1" -Force -ErrorAction SilentlyContinue

# Ярлык на рабочий стол
try {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut("$desktop\Stella Coder.lnk")
    $lnk.TargetPath   = 'cmd.exe'
    $lnk.Arguments    = '/k stella'
    $lnk.Description   = 'Stella Coder CLI'
    $lnk.Save()
} catch {}

Write-Host '  [OK] stella доступна из PowerShell, CMD, Git Bash и Windows Terminal' -ForegroundColor Green

# [4] Готово
Write-Host ''
Write-Host '  [4/4] Готово! ✓' -ForegroundColor Green
Write-Host ''
Write-Host '  Запуск:  ' -NoNewline; Write-Host 'stella' -ForegroundColor Cyan
Write-Host '  (в уже открытых окнах — перезапустите терминал)' -ForegroundColor DarkGray
Write-Host ''

# Запускаем сразу
try {
    stella
} catch {
    Write-Host '  Откройте новый терминал и введите: stella' -ForegroundColor Yellow
}
