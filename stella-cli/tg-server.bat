@echo off
title Stella Telegram Bot Server
echo ============================================
echo   Stella Telegram Bot Server
echo ============================================
echo.

cd /d "%~dp0"

:loop
echo [%date% %time%] Starting bot...
node tg-server.mjs
echo [%date% %time%] Bot stopped, restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
