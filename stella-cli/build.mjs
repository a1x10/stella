#!/usr/bin/env node
// Stella Coder — Build Script (SEA: Single Executable Application)
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DIST = path.join(__dirname, "..", "dist")
const SEA_BLOB = path.join(DIST, "sea-prep.blob")
const EXE_NAME = process.platform === "win32" ? "stella.exe" : "stella"
const OUTPUT = path.join(DIST, EXE_NAME)

console.log()
console.log("\x1b[38;2;167;139;250m  ✦ Stella Coder — Build SEA Executable\x1b[0m")
console.log()

// 1. Clean dist
console.log("  [1/5] Очистка dist/...")
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true })
fs.mkdirSync(DIST, { recursive: true })

// 2. Create single entry point that bundles all modules
console.log("  [2/5] Создание bundled entry point...")

const entryContent = `#!/usr/bin/env node
// Stella Coder — Bundled Single Executable
// This file bundles all CLI modules into one for SEA compilation

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)

// Inline all modules
${inlineModule("stella-cli/theme.mjs")}
${inlineModule("stella-cli/banner.mjs")}
${inlineModule("stella-cli/markdown.mjs")}
${inlineModule("stella-cli/tools.mjs")}
${inlineModule("stella-cli/security.mjs")}

// Re-export for index.mjs
export {
  bold, dim, violet, purple, indigo, blue, cyan, green, red, yellow, gray, darkGray, white,
  gradientLine, box, SPINNER_FRAMES, SPINNER_WORDS,
} from "./theme.mjs"

export { printBanner } from "./banner.mjs"
export { createStreamRenderer, renderMarkdown } from "./markdown.mjs"
export { createTools } from "./tools.mjs"
export {
  verifyCodeIntegrity, getApiKey, saveApiKey, deleteApiKey,
  getHardwareInfo, saveIntegrityHash,
} from "./security.mjs"
`

// Actually, for SEA we need a simpler approach — just copy all files to dist
console.log("  [2/5] Копирование модулей в dist/...")

const filesToCopy = [
  "index.mjs",
  "tools.mjs",
  "banner.mjs",
  "theme.mjs",
  "markdown.mjs",
  "security.mjs",
]

for (const file of filesToCopy) {
  const src = path.join(__dirname, file)
  const dst = path.join(DIST, file)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst)
    console.log(`         ${file}`)
  }
}

// Also copy antimalware directory
const antimalwareSrc = path.join(__dirname, "..", "antimalware")
const antimalwareDst = path.join(DIST, "antimalware")
if (fs.existsSync(antimalwareSrc)) {
  fs.cpSync(antimalwareSrc, antimalwareDst, { recursive: true })
  console.log("         antimalware/")
}

// 3. Create SEA blob
console.log("  [3/5] Создание SEA blob...")
const seaConfig = {
  main: "index.mjs",
  disableExperimentalSEAWarning: true,
}
fs.writeFileSync(path.join(DIST, "sea-config.json"), JSON.stringify(seaConfig, null, 2))

try {
  execSync(`node --experimental-sea-config ${path.join(DIST, "sea-config.json")}`, {
    cwd: DIST,
    stdio: "inherit",
  })
} catch (e) {
  console.log("  ⚠ SEA config не поддерживается этой версией Node.js")
  console.log("    Используйте Node.js 20+ или pkg для компиляции")
  console.log()
  console.log("  Альтернатива: npm install -g pkg && pkg --targets node18-win-x64 .")
  console.log()
  process.exit(0)
}

// 4. Copy node executable
console.log("  [4/5] Копирование Node.js executable...")
const nodeExe = process.execPath
const targetExe = path.join(DIST, EXE_NAME)
fs.copyFileSync(nodeExe, targetExe)

// 5. Inject SEA blob into executable
console.log("  [5/5] Инжектирование blob в executable...")
try {
  const { execSync: exec } = await import("node:child_process")
  if (process.platform === "win32") {
    exec(`npx postject ${targetExe} NODE_SEA_BLOB ${SEA_BLOB} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
      cwd: DIST,
      stdio: "inherit",
    })
  } else {
    exec(`npx postject ${targetExe} NODE_SEA_BLOB ${SEA_BLOB} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
      cwd: DIST,
      stdio: "inherit",
    })
  }
} catch (e) {
  console.log("  ⚠ Postject не удался. Попробуйте:")
  console.log("    npm install -g postject")
  console.log("    postject stella.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2")
}

// Cleanup
try { fs.unlinkSync(path.join(DIST, "sea-prep.blob")) } catch {}
try { fs.unlinkSync(path.join(DIST, "sea-config.json")) } catch {}

console.log()
console.log(`\x1b[38;2;0;200;100m  ✓ Готово: ${OUTPUT}\x1b[0m`)
console.log(dim(`    Размер: ${(fs.statSync(targetExe).size / 1024 / 1024).toFixed(1)} MB`))
console.log()

function inlineModule(relativePath) {
  const fullPath = path.join(__dirname, "..", relativePath)
  try {
    return fs.readFileSync(fullPath, "utf8")
  } catch {
    return `// ${relativePath} not found`
  }
}
