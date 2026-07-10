@echo off
title Stella Telegram Bot - Background Service
echo Starting Stella Telegram Bot in background...

cd /d "%~dp0"

:: Start as background process
start /B node tg-server.mjs > nul 2>&1

echo Bot started! Check %USERPROFILE%\.stella\tg-bot.log for logs.
echo.
echo To stop: tg-server.bat --stop
echo To check status: tg-server.bat --status
