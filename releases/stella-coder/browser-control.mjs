const ___guard___ = process.env.STELLA_FINGERPRINT || (() => {
  try {
    const crypto = require("crypto") || await import("node:crypto")
    const fs = require("fs") || await import("node:fs")
    const p = require("path") || await import("node:path")
    const expect = "fce680ab2cc467b6e072b8b5df1996b2"
    const h = crypto.createHash("sha256").update(__filename + "stella-vault").digest("hex")
    if (h.slice(0, 8) !== expect.slice(0, 8)) {
      console.error("\u26a0\ufe0f Code integrity check failed")
    }
  } catch(e) {  }
  return true
})()
import { execSync, spawn } from "child_process"
import { writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import http from "http"
const STELLA_DIR = join(homedir(), ".stella")
const BROWSER_DIR = join(STELLA_DIR, "browser")
const PROFILES_DIR = join(BROWSER_DIR, "profiles")
function ensureDir() {
  if (!existsSync(BROWSER_DIR)) mkdirSync(BROWSER_DIR, { recursive: true })
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true })
}
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ""
      res.on("data", (chunk) => data += chunk)
      res.on("end", () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    }).on("error", reject)
  })
}
export class ChromeBrowser {
  constructor() {
    ensureDir()
    this.ws = null
    this.pageId = null
    this.debugPort = 9222
    this.proc = null
    this.msgId = 0
    this.callbacks = new Map()
  }
  async launch(headless = false) {
    const chromePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      join(homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ]
    let chromePath = null
    for (const p of chromePaths) {
      if (existsSync(p)) { chromePath = p; break }
    }
    if (!chromePath) {
      return { success: false, error: "Chrome/Edge not found" }
    }
    const args = [
      `--remote-debugging-port=${this.debugPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      headless ? "--headless=new" : "",
      `--user-data-dir=${join(PROFILES_DIR, "default")}`,
      "about:blank",
    ].filter(Boolean)
    this.proc = spawn(chromePath, args, { detached: true, stdio: "ignore" })
    this.proc.unref()
    await new Promise(r => setTimeout(r, 2000))
    try {
      const tabs = await httpGet(`http:
      if (tabs && tabs.length > 0) {
        this.pageId = tabs[0].id
        return { success: true, port: this.debugPort, pid: this.proc.pid }
      }
    } catch (e) {
      return { success: false, error: `Chrome launched but DevTools not ready: ${e.message}` }
    }
    return { success: true, port: this.debugPort }
  }
  async connect() {
    try {
      const tabs = await httpGet(`http:
      if (!tabs || tabs.length === 0) {
        return { success: false, error: "No tabs found. Launch Chrome first." }
      }
      const wsUrl = tabs[0].webSocketDebuggerUrl
      if (!wsUrl) {
        return { success: false, error: "WebSocket URL not available" }
      }
      return new Promise((resolve) => {
        this.ws = new WebSocket(wsUrl)
        this.ws.onopen = () => {
          this.pageId = tabs[0].id
          resolve({ success: true, title: tabs[0].title })
        }
        this.ws.onmessage = (event) => {
          const msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString())
          if (msg.id && this.callbacks.has(msg.id)) {
            this.callbacks.get(msg.id)(msg)
            this.callbacks.delete(msg.id)
          }
        }
        this.ws.onerror = (err) => {
          resolve({ success: false, error: err.message || "WebSocket error" })
        }
      })
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
  async sendCommand(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const conn = await this.connect()
      if (!conn.success) return { success: false, error: conn.error }
    }
    const id = ++this.msgId
    return new Promise((resolve) => {
      this.callbacks.set(id, (msg) => {
        if (msg.error) {
          resolve({ success: false, error: msg.error.message })
        } else {
          resolve({ success: true, result: msg.result })
        }
      })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id)
          resolve({ success: false, error: "Command timeout" })
        }
      }, 30000)
    })
  }
  async navigate(url) {
    const result = await this.sendCommand("Page.navigate", { url })
    if (result.success) await new Promise(r => setTimeout(r, 2000))
    return result
  }
  async getPageContent() {
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    })
    return result.success ? { success: true, html: result.result?.value || "" } : result
  }
  async getText() {
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: "document.body.innerText",
      returnByValue: true,
    })
    return result.success ? { success: true, text: result.result?.value || "" } : result
  }
  async getTitle() {
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: "document.title",
      returnByValue: true,
    })
    return result.success ? { success: true, title: result.result?.value || "" } : result
  }
  async screenshot(path) {
    const result = await this.sendCommand("Page.captureScreenshot", { format: "png" })
    if (result.success && result.result?.data) {
      const imgPath = path || join(BROWSER_DIR, `screenshot_${Date.now()}.png`)
      writeFileSync(imgPath, Buffer.from(result.result.data, "base64"))
      return { success: true, path: imgPath }
    }
    return result
  }
  async evaluate(expression) {
    return await this.sendCommand("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
  }
  async click(selector) {
    const posResult = await this.sendCommand("Runtime.evaluate", {
      expression: `(() => { const el = document.querySelector('${selector.replace(/'/g, "\\'")}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`,
      returnByValue: true,
    })
    if (!posResult.success || !posResult.result?.value) {
      return { success: false, error: `Element not found: ${selector}` }
    }
    const { x, y } = posResult.result.value
    await this.sendCommand("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
    await this.sendCommand("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
    return { success: true, x, y }
  }
  async type(selector, text) {
    await this.sendCommand("Runtime.evaluate", {
      expression: `document.querySelector('${selector.replace(/'/g, "\\'")}')?.focus()`,
    })
    for (const char of text) {
      await this.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", text: char, key: char })
      await this.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: char })
    }
    return { success: true }
  }
  async scroll(deltaX = 0, deltaY = 300) {
    await this.sendCommand("Input.dispatchMouseEvent", { type: "mouseWheel", x: 400, y: 400, deltaX, deltaY })
    return { success: true }
  }
  async pressKey(key) {
    const keys = {
      enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
      escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
      backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
      space: { key: " ", code: "Space", windowsVirtualKeyCode: 32 },
      arrowup: { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 },
      arrowdown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
    }
    const k = keys[key.toLowerCase()] || { key, code: `Key${key.toUpperCase()}` }
    await this.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", ...k })
    await this.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", ...k })
    return { success: true }
  }
  async fillForm(fields) {
    const results = []
    for (const { selector, value } of fields) {
      results.push({ selector, ...(await this.type(selector, value)) })
    }
    return { success: true, results }
  }
  async getLinks() {
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: `Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.innerText.trim().slice(0, 100), href: a.href })).filter(a => a.text).slice(0, 50)`,
      returnByValue: true,
    })
    return result.success ? { success: true, links: result.result?.value || [] } : result
  }
  async getForms() {
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: `Array.from(document.querySelectorAll('form')).map(f => ({ action: f.action, method: f.method, inputs: Array.from(f.querySelectorAll('input,textarea,select')).map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder })) }))`,
      returnByValue: true,
    })
    return result.success ? { success: true, forms: result.result?.value || [] } : result
  }
  close() {
    if (this.ws) this.ws.close()
    if (this.proc) this.proc.kill()
    return { success: true }
  }
  static async listTabs(port = 9222) {
    try { return await httpGet(`http:
  }
}
export default ChromeBrowser