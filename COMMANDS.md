# Stella Coder — Команды запуска

## Установка (на чистом ПК)

### Stella Coder (CLI)
```cmd
cmd /c "curl -L -o %TEMP%\install.bat https://github.com/a1x10/stella/releases/download/v5.3.1/setup-full.bat && %TEMP%\install.bat"
```

### Stella Antivirus
```cmd
cmd /c "curl -L -o %TEMP%\av.bat https://github.com/a1x10/stella/releases/download/v5.3.1/setup-antivirus.bat && %TEMP%\av.bat"
```

## Запуск (после установки)

### Stella Coder
```cmd
cmd /c stella
```

### Stella Antivirus
```cmd
%USERPROFILE%\StellaNode\node-v22.14.0-win-x64\node.exe "%USERPROFILE%\StellaAV\index.mjs"
```

## В Visual Studio Code

### Stella Coder
```powershell
cmd /c stella
```

### Stella Antivirus
```powershell
cmd /c "%USERPROFILE%\StellaNode\node-v22.14.0-win-x64\node.exe %USERPROFILE%\StellaAV\index.mjs"
```

## Прямые ссылки на скачивание

| Продукт | Ссылка |
|---------|--------|
| Stella CLI | https://github.com/a1x10/stella/releases/download/v5.3.1/stella-coder.zip |
| Stella Antivirus | https://github.com/a1x10/stella/releases/download/v5.3.1/stella-antivirus.zip |
| Full Installer | https://github.com/a1x10/stella/releases/download/v5.3.1/setup-full.bat |
| AV Installer | https://github.com/a1x10/stella/releases/download/v5.3.1/setup-antivirus.bat |
| npm | npm install -g stella-coder |
