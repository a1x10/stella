#!/usr/bin/env node
// Stella Coder — Publish to npm
import { execSync } from "node:child_process"
import fs from "node:fs"

console.log("\n  ✦ Stella Coder — Publish to npm\n")

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
console.log(`  Версия: ${pkg.version}`)
console.log(`  Имя: ${pkg.name}\n`)

// Publish
console.log("  [1/1] Публикация...")
try {
  execSync("npm publish --access public", { stdio: "inherit" })
  console.log("\n  ✓ Опубликовано!\n")
} catch (e) {
  console.error("\n  ✗ Ошибка публикации:", e.message)
  process.exit(1)
}

console.log("  Установка для пользователей:")
console.log(`  npm install -g ${pkg.name}\n`)
