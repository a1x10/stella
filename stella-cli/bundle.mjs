#!/usr/bin/env node
// Stella Coder — сборка единого бандла (модель Claude Code: один файл + рантайм Node)
// Результат: dist/stella.mjs — самодостаточный файл, работает без node_modules.
// Запуск: node stella-cli/bundle.mjs   (или: npm run build:bundle)

import { build } from "esbuild"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const outfile = path.join(root, "dist", "stella.mjs")

console.log("\n  \x1b[38;2;167;139;250m✦ Stella Coder — сборка бандла\x1b[0m\n")

fs.mkdirSync(path.join(root, "dist"), { recursive: true })

await build({
  entryPoints: [path.join(__dirname, "index.mjs")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile,
  // jsdom опционален (обёрнут в try/catch в web-parser) — не тянем в бандл
  external: ["jsdom"],
  // shim: даём CJS-зависимостям (@vercel/oidc и др.) рабочий require в ESM
  banner: {
    js: "import{createRequire as __cr}from'module';const require=__cr(import.meta.url);",
  },
  logLevel: "error",
})

const kb = (fs.statSync(outfile).size / 1024 / 1024).toFixed(1)
console.log(`  \x1b[38;2;0;200;100m✓ Готово: dist/stella.mjs (${kb} MB)\x1b[0m\n`)
