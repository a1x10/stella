import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { execSync } from "child_process"
const STELLA_DIR = join(homedir(), ".stella")
const MONITOR_DIR = join(STELLA_DIR, "monitor")
const HISTORY_FILE = join(MONITOR_DIR, "history.json")
const ALERTS_FILE = join(MONITOR_DIR, "alerts.json")
const SCREENSHOTS_DIR = join(MONITOR_DIR, "screenshots")
const MONITOR_STATE = join(MONITOR_DIR, "state.json")
function ensureDir() {
  if (!existsSync(MONITOR_DIR)) mkdirSync(MONITOR_DIR, { recursive: true })
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}
function loadJSON(file, fallback) {
  try { return JSON.parse(readFileSync(file, "utf-8")) } catch { return fallback }
}
function saveJSON(file, data) {
  ensureDir()
  writeFileSync(file, JSON.stringify(data, null, 2))
}
function captureScreenSync() {
  const ts = Date.now()
  const outPath = join(SCREENSHOTS_DIR, `screen_${ts}.png`)
  const tempPath = join(SCREENSHOTS_DIR, `_temp.png`)
  const psScriptPath = join(SCREENSHOTS_DIR, `_capture.ps1`)
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $bitmap.Save("${tempPath.replace(/\\/g, "\\\\")}")
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Output "OK"
} catch {
  Write-Output "FAIL:$($_.Exception.Message)"
}
`.trim()
  try {
    writeFileSync(psScriptPath, psScript, "utf-8")
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
    if (result.startsWith("OK") && existsSync(tempPath)) {
      const data = readFileSync(tempPath)
      writeFileSync(outPath, data)
      try { unlinkSync(tempPath) } catch {}
      try { unlinkSync(psScriptPath) } catch {}
      return outPath
    }
    try { unlinkSync(psScriptPath) } catch {}
    return null
  } catch {
    return null
  }
}
function compressImage(imagePath, maxWidth = 800) {
  const compressedPath = imagePath.replace(".png", "_small.png")
  const psScriptPath = join(SCREENSHOTS_DIR, `_compress.ps1`)
  const psScript = `
Add-Type -AssemblyName System.Drawing
try {
  $img = [System.Drawing.Image]::FromFile("${imagePath.replace(/\\/g, "\\\\")}")
  $ratio = ${maxWidth} / $img.Width
  if ($ratio -ge 1) { $ratio = 1 }
  $newW = [int]($img.Width * $ratio)
  $newH = [int]($img.Height * $ratio)
  $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $newW, $newH)
  $bmp.Save("${compressedPath.replace(/\\/g, "\\\\")}")
  $g.Dispose()
  $bmp.Dispose()
  $img.Dispose()
  Write-Output "OK"
} catch {
  Write-Output "FAIL"
}
`.trim()
  try {
    writeFileSync(psScriptPath, psScript, "utf-8")
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    })
    try { unlinkSync(psScriptPath) } catch {}
    if (existsSync(compressedPath)) {
      return compressedPath
    }
  } catch {}
  return imagePath
}
export class ScreenMonitor {
  constructor() {
    ensureDir()
    this.state = loadJSON(MONITOR_STATE, {
      running: false,
      interval: 2000,
      startedAt: null,
      totalCaptures: 0,
      totalAlerts: 0,
      pid: null,
    })
    this.history = loadJSON(HISTORY_FILE, [])
    this.alerts = loadJSON(ALERTS_FILE, [])
    this.intervalId = null
  }
  save() {
    saveJSON(MONITOR_STATE, this.state)
    saveJSON(HISTORY_FILE, this.history.slice(-500))
    saveJSON(ALERTS_FILE, this.alerts.slice(-200))
  }
  async captureAndAnalyze(visionFn) {
    const imagePath = captureScreenSync()
    if (!imagePath) {
      return { success: false, error: "Failed to capture screen" }
    }
    const stats = statSync(imagePath)
    const sizeKB = Math.round(stats.size / 1024)
    const compressedPath = compressImage(imagePath, 600)
    let imageBase64
    try {
      imageBase64 = readFileSync(compressedPath).toString("base64")
    } catch {
      imageBase64 = readFileSync(imagePath).toString("base64")
    }
    const ts = new Date().toISOString()
    const capture = {
      id: Date.now().toString(36),
      timestamp: ts,
      path: imagePath,
      sizeKB,
      analysis: null,
      alerts: [],
    }
    if (visionFn) {
      try {
        const analysis = await visionFn(imageBase64, this.getRecentContext())
        capture.analysis = analysis
        const alertKeywords = [
          "error", "crash", "exception", "fatal", "alert", "warning", "failed",
          "ошибка", "краш", "исключение", "фатальная", "предупреждение", "сбой",
          "not responding", "has stopped", "dead", "kill", "terminate",
          "не отвечает", "остановлен", "завершить",
        ]
        const textLower = (analysis.text || "").toLowerCase()
        const detected = alertKeywords.filter(k => textLower.includes(k))
        if (detected.length > 0) {
          const alert = {
            id: capture.id,
            timestamp: ts,
            type: detected.join(", "),
            severity: detected.some(k => ["fatal", "crash", "exception", "фатальная", "краш", "исключение"].includes(k)) ? "critical" : "warning",
            description: analysis.text?.slice(0, 500),
            screenshot: imagePath,
          }
          capture.alerts.push(alert)
          this.alerts.push(alert)
          this.state.totalAlerts++
        }
      } catch (err) {
        capture.analysis = { error: err.message }
      }
    }
    this.history.push(capture)
    this.state.totalCaptures++
    this.save()
    this.cleanOldScreenshots(50)
    return { success: true, capture }
  }
  getRecentContext() {
    const recent = this.history.slice(-5)
    return recent.map(h => ({
      time: h.timestamp,
      analysis: h.analysis?.summary || h.analysis?.text?.slice(0, 200) || "no analysis",
      alerts: h.alerts?.length || 0,
    }))
  }
  cleanOldScreenshots(keep = 50) {
    try {
      const files = readdirSync(SCREENSHOTS_DIR)
        .filter(f => f.startsWith("screen_") && f.endsWith(".png"))
        .sort()
      if (files.length > keep) {
        const toDelete = files.slice(0, files.length - keep)
        for (const f of toDelete) {
          try { unlinkSync(join(SCREENSHOTS_DIR, f)) } catch {}
        }
      }
    } catch {}
  }
  start(intervalMs, visionFn) {
    if (this.state.running) {
      return { success: false, error: "Monitor already running" }
    }
    this.state.running = true
    this.state.startedAt = new Date().toISOString()
    this.state.interval = intervalMs || 2000
    this.state.pid = process.pid
    this.save()
    this.intervalId = setInterval(async () => {
      if (!this.state.running) {
        this.stop()
        return
      }
      await this.captureAndAnalyze(visionFn)
    }, this.state.interval)
    return { success: true, interval: this.state.interval }
  }
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.state.running = false
    this.state.pid = null
    this.save()
    return { success: true }
  }
  getStatus() {
    const recentAlerts = this.alerts.slice(-10)
    const recentCaptures = this.history.slice(-5)
    return {
      running: this.state.running,
      startedAt: this.state.startedAt,
      interval: this.state.interval,
      totalCaptures: this.state.totalCaptures,
      totalAlerts: this.state.totalAlerts,
      pid: this.state.pid,
      recentAlerts,
      recentCaptures: recentCaptures.map(c => ({
        time: c.timestamp,
        size: c.sizeKB + "KB",
        summary: c.analysis?.summary || c.analysis?.text?.slice(0, 100) || "analyzing...",
        alertCount: c.alerts?.length || 0,
      })),
    }
  }
  getAlerts(since) {
    if (since) {
      return this.alerts.filter(a => new Date(a.timestamp) > new Date(since))
    }
    return this.alerts
  }
  getScreenshotPath() {
    const files = readdirSync(SCREENSHOTS_DIR)
      .filter(f => f.startsWith("screen_") && f.endsWith(".png"))
      .sort()
    return files.length > 0 ? join(SCREENSHOTS_DIR, files[files.length - 1]) : null
  }
  generateReport() {
    const status = this.getStatus()
    const alertsByType = {}
    for (const a of this.alerts) {
      alertsByType[a.type] = (alertsByType[a.type] || 0) + 1
    }
    const report = `
═══════════════════════════════════════════
  👁️  SCREEN MONITOR REPORT
═══════════════════════════════════════════
Status:       ${status.running ? "🟢 RUNNING" : "🔴 STOPPED"}
Started:      ${status.startedAt ? new Date(status.startedAt).toLocaleString() : "Never"}
Interval:     every ${status.interval / 1000}s
Total captures: ${status.totalCaptures}
Total alerts:   ${status.totalAlerts}
${Object.keys(alertsByType).length > 0 ? `
Alert breakdown:
${Object.entries(alertsByType).map(([type, count]) => `  ⚠️  ${type}: ${count}`).join("\n")}
` : "No alerts detected."}
Recent captures:
${status.recentCaptures.map(c => `  [${new Date(c.time).toLocaleTimeString()}] ${c.summary} ${c.alertCount > 0 ? `⚠️ ${c.alertCount} alerts` : "✅"}`).join("\n")}
═══════════════════════════════════════════
`.trim()
    return report
  }
}
export default ScreenMonitor