@echo off
title Stella Coder - Установка
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        STELLA CODER v4.0.0               ║
echo  ║        AI Coding Agent + Telegram Bot     ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Установка...
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [!] Node.js не найден!
    echo  Скачайте: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Install globally
echo  [1/3] Устанавливаю stella-coder...
npm install -g stella-coder
if %errorlevel% neq 0 (
    echo  [!] Ошибка установки
    pause
    exit /b 1
)

echo  [2/3] Проверяю установку...
stella --version

echo  [3/3] Готово!
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║  Установка завершена!                     ║
echo  ║                                           ║
echo  ║  Запуск: stella                           ║
echo  ║  Telegram бот: /tg                        ║
echo  ║  Код для друзей: /tg-code                 ║
echo  ╚══════════════════════════════════════════╝
echo.
pause
