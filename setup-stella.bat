@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo  ✦ Stella Coder CLI — Автоустановка
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

:: Установить через npm
echo  [1/3] Установка stella-coder...
call npm install -g stella-coder 2>nul
if !errorlevel! neq 0 (
  echo  ✗ Ошибка установки.
  pause
  exit /b 1
)

:: Проверить
echo  [2/3] Проверка...
set VERSION=
for /f %%i in ('stella --version') do set VERSION=%%i
echo    Stella Coder !VERSION!

:: Ярлык
echo  [3/3] Создание ярлыка...
set "SHORTCUT=%USERPROFILE%\Desktop\Stella Coder.lnk"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/k stella'; $s.Description = 'Stella Coder CLI'; $s.Save()" 2>nul

echo.
echo  ✓ Установлено!
echo.
stella
pause
