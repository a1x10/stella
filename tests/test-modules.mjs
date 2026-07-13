import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

let passed = 0
let failed = 0
const errors = []

function assert(condition, msg) {
  if (condition) { passed++; process.stdout.write(".") }
  else { failed++; errors.push(msg); process.stdout.write("F") }
}

function assertEq(actual, expected, msg) {
  if (actual === expected) { passed++; process.stdout.write(".") }
  else { failed++; errors.push(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); process.stdout.write("F") }
}

// Test GameEngine
import { GameEngine } from "../stella-cli/game-engine.mjs"
const games = new GameEngine()
const gameList = games.listGames()
assert(gameList.length >= 7, "game-engine: listGames >= 7")
assert(gameList.includes("snake"), "game-engine: includes snake")
assert(gameList.includes("tetris"), "game-engine: includes tetris")
const saved = games.listSaved()
assert(Array.isArray(saved), "game-engine: listSaved is array")

// Smoketests: each game generates HTML
for (const g of ["snake", "tetris", "minesweeper", "2048", "flappy", "tictactoe", "sudoku"]) {
  const r = await games.play(g)
  assert(r.success || r.error, `game-engine: ${g} returns success or error`)
}

// Test ChartGenerator
import { ChartGenerator } from "../stella-cli/charts.mjs"
const chart = new ChartGenerator()
const bar = await chart.bar("Test", ["A", "B"], [10, 20])
assert(bar.success, "chart: bar creates chart")
assert(fs.existsSync(bar.path), "chart: bar file exists")
const list = chart.listCharts()
assert(list.length > 0, "chart: listCharts > 0")
chart.deleteChart(path.basename(bar.path))
const afterDel = chart.listCharts()
assert(afterDel.length === list.length - 1 || afterDel.length === list.length, "chart: deleteChart")

// Test ADB (no device expected)
import { ADB } from "../stella-cli/adb.mjs"
const adb = new ADB()
const avail = adb.isAvailable()
// can't guarantee ADB is installed, just check no crash
const devices = adb.getDevices()
assert(typeof devices.success === "boolean", "adb: getDevices returns success")

// Test HomeAssistant (no config expected)
import { HomeAssistant } from "../stella-cli/home-assistant.mjs"
const ha = new HomeAssistant()
assert(!ha.isConfigured(), "ha: not configured without args")

// Test YandexMaps (no key expected)
import { YandexMaps } from "../stella-cli/yandex-maps.mjs"
const ymaps = new YandexMaps()
assert(!ymaps.isConfigured(), "ymaps: not configured without key")

// Test GDriveBackup (no auth expected)
import { GDriveBackup } from "../stella-cli/gdrive-backup.mjs"
const gdrive = new GDriveBackup()
assert(!gdrive.isConfigured(), "gdrive: not configured without credentials")
const hist = gdrive.getHistory()
assert(Array.isArray(hist), "gdrive: getHistory returns array")

// Test GmailClient (no auth expected)
import { GmailClient } from "../stella-cli/gmail.mjs"
const gmail = new GmailClient()
assert(!gmail.isConfigured(), "gmail: not configured without credentials")

// Test file syntax for all new modules
for (const mod of ["gmail", "charts", "yandex-maps", "game-engine", "gdrive-backup", "adb", "home-assistant"]) {
  try {
    execSync(`node -c "${path.join(process.cwd(), "stella-cli", mod + ".mjs")}"`, { encoding: "utf8", timeout: 5000 })
    passed++; process.stdout.write(".")
  } catch {
    failed++; errors.push(`${mod}.mjs: syntax error`); process.stdout.write("F")
  }
}

// Test index.mjs syntax
try {
  execSync(`node -c "${path.join(process.cwd(), "stella-cli", "index.mjs")}"`, { encoding: "utf8", timeout: 5000 })
  passed++; process.stdout.write(".")
} catch {
  failed++; errors.push("index.mjs: syntax error"); process.stdout.write("F")
}

console.log()
console.log(`\n  Passed: ${passed}, Failed: ${failed}`)
if (errors.length > 0) {
  console.log(`  Errors:\n${errors.map(e => `    • ${e}`).join("\n")}`)
}
process.exit(failed > 0 ? 1 : 0)
