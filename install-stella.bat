@echo off
chcp 65001 >nul
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║     Stella Coder 3.9 - Installer        ║
echo   ║     powered by codex alex                ║
echo   ╚══════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [1/4] Node.js не найден. Установка...
    echo   Скачивание Node.js...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node-install.msi'"
    echo   Установка Node.js...
    msiexec /i "%TEMP%\node-install.msi" /quiet /norestart
    timeout /t 30 >nul
    set PATH=%PATH%;C:\Program Files\nodejs\
) else (
    echo   [1/4] Node.js найден
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo   ОШИБКА: npm не установлен
    pause
    exit /b 1
)

echo   [2/4] Установка Stella Coder...
call npm install -g stella-coder

echo   [3/4] Проверка установки...
stella --version

echo   [4/4] Готово!
echo.
echo   ╔══════════════════════════════════════════╗
echo   ║  Запуск: stella                          ║
echo   ╚══════════════════════════════════════════╝
echo.
pause
