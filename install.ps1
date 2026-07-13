$nd="$env:USERPROFILE\StellaNode"
$np="$nd\node-v22.14.0-win-x64"

Write-Host "  [1/3] Downloading Node.js..."
if(Test-Path"$np\node.exe"){Write-Host "  [OK] Already have Node.js"}
else{
  curl.exe -L -o "$env:TEMP\node.zip" "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
  if(-not(Test-Path"$env:TEMP\node.zip")){Write-Host "  [FAIL] Download failed"; exit 1}
  if(-not(Test-Path$nd)){mkdir $nd}
  Expand-Archive -Path "$env:TEMP\node.zip" -DestinationPath $nd -Force
  Remove-Item "$env:TEMP\node.zip" -Force
  if(-not(Test-Path"$np\node.exe")){Write-Host "  [FAIL] Extract failed"; exit 1}
  Write-Host "  [OK] Node.js installed"
}

Write-Host "  [2/3] Installing stella-coder..."
& "$np\node.exe" "$np\node_modules\npm\bin\npm-cli.js" install -g stella-coder@latest
if($LASTEXITCODE -ne 0){Write-Host "  [FAIL] npm install failed"; exit 1}
Write-Host "  [OK] stella-coder installed"

Write-Host "  [3/3] Removing stella.ps1 wrapper..."
Remove-Item "$np\stella.ps1" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  DONE! Run: & `"$np\stella.cmd`""
