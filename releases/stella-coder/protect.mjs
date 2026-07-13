#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const RELEASES = path.join(ROOT, "releases")
const STELLA_PKG = path.join(RELEASES, "stella-coder")
const AV_PKG = path.join(RELEASES, "stella-antivirus")
function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true })
  fs.mkdirSync(dir, { recursive: true })
}
function copy(src, dst) {
  if (fs.existsSync(src)) {
    if (fs.statSync(src).isDirectory()) {
      if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true })
      for (const item of fs.readdirSync(src)) copy(path.join(src, item), path.join(dst, item))
    } else {
      fs.cpSync(src, dst)
    }
  }
}
function stripComments(code) {
  return code
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\
    .replace(/^\s*[\r\n]/gm, "")
    .trim()
}
function makeReadable(code) {
  return code
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
function addGuard(code) {
  return code
}
console.log("\n  ✦ Stella Coder — Protector & Packager\n")
cleanDir(STELLA_PKG)
cleanDir(AV_PKG)
console.log("  [1/3] Packaging Stella CLI...")
const cliFiles = fs.readdirSync(path.join(ROOT, "stella-cli")).filter(f => f.endsWith(".mjs"))
for (const f of cliFiles) {
  const src = path.join(ROOT, "stella-cli", f)
  let code = fs.readFileSync(src, "utf8")
  code = addGuard(code)
  code = stripComments(code)
  fs.writeFileSync(path.join(STELLA_PKG, f), code)
}
copy(path.join(ROOT, "package.json"), path.join(STELLA_PKG, "package.json"))
copy(path.join(ROOT, "stella-cli", "sea-config.json"), path.join(STELLA_PKG, "sea-config.json"))
copy(path.join(ROOT, "README.md"), path.join(STELLA_PKG, "README.md"))
fs.writeFileSync(path.join(STELLA_PKG, "install-stella.bat"), `@echo off
chcp 65001 >nul
echo.
echo  ✦ Stella Coder — Installation
echo  =============================
echo.
echo  Install: npm i -g stella-coder
echo  Or run:  node stella-cli/index.mjs
echo.
echo  Docs:    https:
echo.
pause
`)
console.log("  [2/3] Packaging Stella Antivirus...")
const avFiles = fs.readdirSync(path.join(ROOT, "antimalware")).filter(f => f.endsWith(".mjs"))
for (const f of avFiles) {
  const src = path.join(ROOT, "antimalware", f)
  let code = fs.readFileSync(src, "utf8")
  code = addGuard(code)
  code = stripComments(code)
  fs.writeFileSync(path.join(AV_PKG, f), code)
}
copy(path.join(ROOT, "antimalware", "index.mjs"), path.join(AV_PKG, "index.mjs"))
fs.writeFileSync(path.join(AV_PKG, "install-av.bat"), `@echo off
chcp 65001 >nul
echo.
echo  ✦ Stella Antivirus — Installation
echo  =================================
echo.
echo  Quick run:  node index.mjs
echo.
echo  Scans your system for threats using
echo  signature-based detection + AI analysis.
echo.
pause
`)
console.log("  [3/3] Creating root installers...")
fs.writeFileSync(path.join(ROOT, "install-stella-pkg.bat"), `@echo off
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
`)
fs.writeFileSync(path.join(ROOT, "install-av.bat"), `@echo off
chcp 65001 >nul
echo.
echo  ✦ Stella Antivirus — Standalone Scanner
echo  =========================================
echo.
echo  Quick start:
echo    node "%CD%\\antimalware\\index.mjs"
echo.
echo  Or add to PATH:
echo    set PATH=%%PATH%%;"%CD%\\antimalware"
echo    stella-antivirus
echo.
echo  Scans:  files, processes, registry, startup
echo  Method: signature database + AI heuristic
echo.
pause
`)
fs.writeFileSync(path.join(ROOT, "run-antivirus.bat"), `@echo off
chcp 65001 >nul
node "%~dp0antimalware\\index.mjs"
pause
`)
console.log(fs.existsSync(path.join(AV_PKG, "index.mjs")) ? "  ✓" : "  ✗")
console.log()
console.log("  Creating archives for GitHub Release...")
const zipDir = path.join(ROOT, "releases")
if (!fs.existsSync(zipDir)) fs.mkdirSync(zipDir, { recursive: true })
try {
  execSync(`powershell -Command "Compress-Archive -Path '${STELLA_PKG}\\*' -DestinationPath '${path.join(zipDir, 'stella-coder.zip')}' -Force"`, { timeout: 15000 })
  console.log("    ✓ stella-coder.zip")
} catch { console.log("    ✗ stella-coder.zip (use 7zip or manual)") }
try {
  execSync(`powershell -Command "Compress-Archive -Path '${AV_PKG}\\*' -DestinationPath '${path.join(zipDir, 'stella-antivirus.zip')}' -Force"`, { timeout: 15000 })
  console.log("    ✓ stella-antivirus.zip")
} catch { console.log("    ✗ stella-antivirus.zip") }
console.log()
console.log("  ✓ Done! Packages in releases/")
console.log()