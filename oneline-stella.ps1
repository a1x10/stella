# Stella Coder CLI — одна строка (скопируй и вставь в PowerShell)
# Установит через npm, создаст ярлык, запустит

Write-Host "✦ Stella Coder CLI" -ForegroundColor Magenta; Write-Host "[1/2] npm install -g stella-coder..."; npm install -g stella-coder; Write-Host "[2/2] Создание ярлыка..."; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Stella Coder.lnk"); $s.TargetPath = "cmd.exe"; $s.Arguments = "/k stella"; $s.Save(); Write-Host "✓ Готово! Введи: stella" -ForegroundColor Green; stella --version
