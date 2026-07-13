@echo off
chcp 65001 >nul
echo.
echo  ✦ Stella Antivirus — Standalone Scanner
echo  =========================================
echo.
echo  Quick start:
echo    node "%CD%\antimalware\index.mjs"
echo.
echo  Or add to PATH:
echo    set PATH=%%PATH%%;"%CD%\antimalware"
echo    stella-antivirus
echo.
echo  Scans:  files, processes, registry, startup
echo  Method: signature database + AI heuristic
echo.
pause
