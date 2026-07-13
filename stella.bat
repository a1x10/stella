@echo off
set "PATH=%USERPROFILE%\StellaNode\node-v22.14.0-win-x64;%PATH%"
node "%USERPROFILE%\StellaNode\node-v22.14.0-win-x64\node_modules\stella-coder\stella-cli\index.mjs" %*
