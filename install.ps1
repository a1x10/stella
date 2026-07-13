$ErrorActionPreference="SilentlyContinue"
$nd="$env:USERPROFILE\StellaNode"; $nv="v22.14.0"; $np="$nd\node-$nv-win-x64"
if(-not(Test-Path"$np\node.exe")){Write-Host"  Downloading Node.js..."; Invoke-WebRequest -Uri "https://nodejs.org/dist/$nv/node-$nv-win-x64.zip" -OutFile "$env:TEMP\n.zip" -UseBasicParsing; if(-not(Test-Path$nd)){New-Item -ItemType Directory -Path $nd -Force|Out-Null}; Expand-Archive -Path "$env:TEMP\n.zip" -DestinationPath $nd -Force; Remove-Item "$env:TEMP\n.zip" -Force}
$env:PATH="$np;$env:PATH"
Write-Host"  Installing stella-coder..."
& "$np\node.exe" "$np\node_modules\npm\bin\npm-cli.js" install -g stella-coder@latest
Write-Host"  Done! Run: stella.cmd"
