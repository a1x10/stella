@echo off
echo.
echo   ✦ Stella Coder 3.9 — Установка
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ОШИБКА: Node.js не установлен
    echo   Скачайте: https://nodejs.org
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo   ОШИБКА: npm не установлен
    pause
    exit /b 1
)

echo   [1/3] Установка зависимостей...
call npm install

echo   [2/3] Установка команд...
call npm link

echo   [3/3] Проверка...
node stella-cli/index.mjs --version

echo.
echo   ✓ Готово! Запуск: stella
echo.
pause
