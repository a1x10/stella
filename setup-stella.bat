@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo  ✦ Stella Coder CLI — Автоустановка
echo  ===================================
echo.

:: 1. Установить через npm
echo  [1/3] Установка через npm...
call npm install -g stella-coder 2>nul
if %errorlevel% neq 0 (
  echo  ✗ npm не найден. Установи Node.js: https://nodejs.org
  pause
  exit /b 1
)

:: 2. Проверить
echo  [2/3] Проверка...
set VERSION=
for /f %%i in ('stella --version') do set VERSION=%%i
echo    Stella Coder %VERSION%

:: 3. Создать ярлык
echo  [3/3] Создание ярлыка...
set "SHORTCUT=%USERPROFILE%\Desktop\Stella Coder.lnk"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/k stella'; $s.Description = 'Stella Coder CLI'; $s.Save()" 2>nul

echo.
echo  ✓ Установлено!
echo.
echo  Запуск: stella
echo  Ярлык:  %SHORTCUT%
echo.
pause
