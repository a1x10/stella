import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync, spawn } from "node:child_process"
import { startBot, stopBot } from "./telegram-bot.mjs"
const CONFIG_DIR = path.join(os.homedir(), ".stella")
const PID_FILE = path.join(CONFIG_DIR, "tg-bot.pid")
const LOG_FILE = path.join(CONFIG_DIR, "tg-bot.log")
function log(msg) {
  const timestamp = new Date().toLocaleString("ru-RU")
  const line = `[${timestamp}] ${msg}`
  console.log(line)
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.appendFileSync(LOG_FILE, line + "\n")
  } catch {}
}
function savePID() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(PID_FILE, String(process.pid))
}
function removePID() {
  try { fs.unlinkSync(PID_FILE) } catch {}
}
function isRunning() {
  try {
    if (!fs.existsSync(PID_FILE)) return false
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8"))
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
process.on("SIGINT", () => {
  log("Bot shutting down (SIGINT)")
  removePID()
  process.exit(0)
})
process.on("SIGTERM", () => {
  log("Bot shutting down (SIGTERM)")
  removePID()
  process.exit(0)
})
process.on("exit", () => {
  removePID()
})
async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--stop")) {
    if (!isRunning()) {
      console.log("Bot is not running")
      return
    }
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf8"))
    try {
      process.kill(pid, "SIGTERM")
      console.log(`Bot stopped (PID: ${pid})`)
      removePID()
    } catch (e) {
      console.log(`Failed to stop: ${e.message}`)
    }
    return
  }
  if (args.includes("--status")) {
    if (isRunning()) {
      const pid = fs.readFileSync(PID_FILE, "utf8")
      console.log(`Bot is running (PID: ${pid})`)
    } else {
      console.log("Bot is not running")
    }
    return
  }
  if (isRunning()) {
    const pid = fs.readFileSync(PID_FILE, "utf8")
    console.log(`Bot already running (PID: ${pid})`)
    return
  }
  savePID()
  log(`Bot starting (PID: ${process.pid})`)
  log(`Platform: ${os.platform()} ${os.release()}`)
  log(`Node: ${process.version}`)
  const result = await startBot()
  if (result) {
    log("Bot started successfully")
    console.log("Stella Telegram Bot is running!")
    console.log("Press Ctrl+C to stop")
  } else {
    log("Bot failed to start")
    removePID()
    process.exit(1)
  }
}
main()