@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo  ✦ Stella Antivirus — Автоустановка
echo  ===================================
echo.

:: Проверка Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  [*] Node.js не найден. Скачиваю...
  set "NODE_DIR=%LOCALAPPDATA%\StellaNode\node-v22.14.0-win-x64"
  curl -L "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -o "%TEMP%\node.zip" 2>nul
  powershell -Command "Expand-Archive -Path '%TEMP%\node.zip' -DestinationPath '%LOCALAPPDATA%\StellaNode' -Force"
  set "PATH=%NODE_DIR%;%PATH%"
  reg add "HKCU\Environment" /v Path /d "%NODE_DIR%;%PATH%" /f >nul
  echo  ✓ Node.js установлен
)

:: Скачать
echo  [1/3] Скачивание антивируса...
curl -L "https://github.com/a1x10/stella/releases/download/v5.3.1/stella-antivirus.zip" -o "%TEMP%\stella-av.zip" 2>nul
if !errorlevel! neq 0 (
  echo  ✗ Ошибка скачивания.
  pause
  exit /b 1
)

:: Распаковать
echo  [2/3] Распаковка...
set "AV_DIR=%USERPROFILE%\StellaAV"
if not exist "%AV_DIR%" mkdir "%AV_DIR%"
powershell -Command "Expand-Archive -Path '%TEMP%\stella-av.zip' -DestinationPath '%AV_DIR%' -Force" 2>nul

:: Ярлык
echo  [3/3] Создание ярлыка...
set "SHORTCUT=%USERPROFILE%\Desktop\Stella Antivirus.lnk"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'node.exe'; $s.Arguments = '\"%AV_DIR%\index.mjs\"'; $s.WorkingDirectory = '%AV_DIR%'; $s.Description = 'Stella Antivirus Scanner'; $s.Save()" 2>nul

echo.
echo  ✓ Готово!
echo.
node "%AV_DIR%\index.mjs"
pause
