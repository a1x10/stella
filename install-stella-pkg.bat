@echo off
chcp 65001 >nul
echo.
echo  ✦ Stella Coder v5.3.1 — AI Coding Agent
echo  =========================================
echo.
echo  [1] npm install -g stella-coder
call npm install -g stella-coder
echo.
echo  [2] Verify installation
call stella --version
echo.
if %errorlevel% equ 0 (
  echo  ✓ Stella Coder installed!
  echo.
  echo  Type "stella" to start
) else (
  echo  ✗ Try: node %~dp0stella-cli/index.mjs
)
echo.
pause
