@echo off
chcp 65001 >nul
title Stella Antivirus - Installer
color 0B
cls
echo.
echo   ==============================
echo    Stella Antivirus Installer
echo   ==============================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [*] Node.js not found. Downloading...
    echo.
    curl -L -o "%TEMP%\node.zip" "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" 2>nul
    if exist "%TEMP%\node.zip" (
        powershell -Command "Expand-Archive -Path '%TEMP%\node.zip' -DestinationPath '%USERPROFILE%\StellaNode' -Force"
        set "PATH=%USERPROFILE%\StellaNode\node-v22.14.0-win-x64;%PATH%"
        echo   [OK] Node.js installed
    ) else (
        echo   [ERROR] Cannot download Node.js
        echo   Install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
)

echo   Node.js: & node --version
echo.

:: Download antivirus
echo   [1/3] Downloading antivirus...
curl -L -o "%TEMP%\stella-av.zip" "https://github.com/a1x10/stella/releases/download/v5.3.1/stella-antivirus.zip" 2>nul
if not exist "%TEMP%\stella-av.zip" (
    echo   [ERROR] Download failed
    pause
    exit /b 1
)

:: Extract
echo   [2/3] Extracting...
if not exist "%USERPROFILE%\StellaAV" mkdir "%USERPROFILE%\StellaAV"
powershell -Command "Expand-Archive -Path '%TEMP%\stella-av.zip' -DestinationPath '%USERPROFILE%\StellaAV' -Force"

:: Shortcut
echo   [3/3] Creating shortcut...
powershell -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%USERPROFILE%\Desktop\Stella Antivirus.lnk'); $s.TargetPath='node.exe'; $s.Arguments='\""%USERPROFILE%\StellaAV\index.mjs\""; $s.WorkingDirectory='%USERPROFILE%\StellaAV'; $s.Save()"

echo.
echo   ==============================
echo    DONE!
echo    Desktop shortcut created
echo   ==============================
echo.
echo   Launching antivirus...
echo.
node "%USERPROFILE%\StellaAV\index.mjs"
pause
