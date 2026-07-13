@echo off
chcp 65001 >nul
title Stella Coder - Full Installer
cls
echo.
echo   ===================================
echo    Stella Coder - Full Installer
echo   ===================================
echo.

:: Step 1: Download Node.js
echo   [1/4] Downloading Node.js...
if exist "%USERPROFILE%\StellaNode\node-v22.14.0-win-x64\node.exe" (
    echo   [OK] Node.js already installed
) else (
    curl -L -o "%TEMP%\node.zip" "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" 2>nul
    if not exist "%TEMP%\node.zip" (
        echo   [ERROR] Cannot download Node.js
        pause
        exit /b 1
    )
    powershell -Command "Expand-Archive -Path '%TEMP%\node.zip' -DestinationPath '%USERPROFILE%\StellaNode' -Force"
    echo   [OK] Node.js installed
)

:: Step 2: Add to PATH permanently
echo   [2/4] Adding Node.js to PATH...
set "NODEPATH=%USERPROFILE%\StellaNode\node-v22.14.0-win-x64"
setx PATH "%NODEPATH%;%PATH%" >nul 2>nul
set "PATH=%NODEPATH%;%PATH%"
echo   [OK] PATH updated

:: Step 3: Install stella-coder
echo   [3/4] Installing stella-coder via npm...
call "%NODEPATH%\node.exe" "%NODEPATH%\node_modules\npm\bin\npm-cli.js" install -g stella-coder
if %errorlevel% neq 0 (
    echo   [ERROR] npm install failed
    pause
    exit /b 1
)
echo   [OK] stella-coder installed

:: Step 4: Create desktop shortcut
echo   [4/4] Creating desktop shortcut...
echo Set oWS = WScript.CreateObject^("WScript.Shell"^) > "%TEMP%\shortcut.vbs"
echo Set oLink = oWS.CreateShortcut^("%USERPROFILE%\Desktop\Stella Coder.lnk"^) >> "%TEMP%\shortcut.vbs"
echo oLink.TargetPath = "%NODEPATH%\node.exe" >> "%TEMP%\shortcut.vbs"
echo oLink.Arguments = """%NODEPATH%\node_modules\stella-coder\stella-cli\index.mjs""" >> "%TEMP%\shortcut.vbs"
echo oLink.WorkingDirectory = "%USERPROFILE%" >> "%TEMP%\shortcut.vbs"
echo oLink.Save >> "%TEMP%\shortcut.vbs"
cscript //nologo "%TEMP%\shortcut.vbs" >nul 2>nul
del "%TEMP%\shortcut.vbs" >nul 2>nul

echo.
echo   ===================================
echo    DONE!
echo   ===================================
echo.
echo   Launch: stella
echo   Or double-click "Stella Coder" on Desktop
echo.

:: Launch stella
"%NODEPATH%\node.exe" "%NODEPATH%\node_modules\stella-coder\stella-cli\index.mjs"
pause
