import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
const ADB_DIR = path.join(os.homedir(), ".stella", "adb")
function ensureDir() { if (!fs.existsSync(ADB_DIR)) fs.mkdirSync(ADB_DIR, { recursive: true }) }
function adb(args) {
  try {
    return execSync(`adb ${args}`, { encoding: "utf8", timeout: 10000 }).trim()
  } catch (e) {
    return { error: e.stderr?.trim() || e.message }
  }
}
export class ADB {
  constructor() { ensureDir() }
  isAvailable() {
    try {
      execSync("adb --version", { encoding: "utf8", stdio: "ignore" })
      return true
    } catch { return false }
  }
  getDevices() {
    const out = adb("devices")
    if (out.error) return { success: false, error: out.error }
    const lines = out.split("\n").filter(l => l.trim() && !l.includes("List of devices"))
    const devices = lines.map(l => { const [id, status] = l.trim().split(/\s+/); return { id, status } })
    return { success: true, devices }
  }
  getState(serial) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} get-state`)
    return out.error ? { success: false, error: out.error } : { success: true, state: out }
  }
  shell(serial, cmd) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} shell ${cmd}`)
    return out.error ? { success: false, error: out.error } : { success: true, output: out }
  }
  screenshot(serial) {
    ensureDir()
    const s = serial ? `-s ${serial}` : ""
    const filename = `screenshot_${Date.now()}.png`
    const localPath = path.join(ADB_DIR, filename)
    adb(`${s} exec-out screencap -p > "${localPath}"`)
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
      return { success: true, path: localPath }
    }
    try {
      adb(`${s} shell screencap -p /sdcard/screen.png`)
      adb(`${s} pull /sdcard/screen.png "${localPath}"`)
      adb(`${s} shell rm /sdcard/screen.png`)
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) return { success: true, path: localPath }
    } catch {}
    return { success: false, error: "Screenshot failed" }
  }
  tap(serial, x, y) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} shell input tap ${x} ${y}`)
    return out.error ? { success: false, error: out.error } : { success: true }
  }
  swipe(serial, x1, y1, x2, y2, duration = 300) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`)
    return out.error ? { success: false, error: out.error } : { success: true }
  }
  text(serial, text) {
    const s = serial ? `-s ${serial}` : ""
    const escaped = text.replace(/ /g, "%s").replace(/"/g, '\\"')
    const out = adb(`${s} shell input text "${escaped}"`)
    return out.error ? { success: false, error: out.error } : { success: true }
  }
  key(serial, keycode) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} shell input keyevent ${keycode}`)
    return out.error ? { success: false, error: out.error } : { success: true }
  }
  pressHome(serial) { return this.key(serial, 3) }
  pressBack(serial) { return this.key(serial, 4) }
  pressMenu(serial) { return this.key(serial, 82) }
  pressPower(serial) { return this.key(serial, 26) }
  pressVolumeUp(serial) { return this.key(serial, 24) }
  pressVolumeDown(serial) { return this.key(serial, 25) }
  installApp(serial, apkPath) {
    if (!fs.existsSync(apkPath)) return { success: false, error: "APK not found" }
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} install "${apkPath}"`)
    if (out.error) return { success: false, error: out.error }
    return { success: true, output: out }
  }
  uninstallApp(serial, packageName) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} uninstall ${packageName}`)
    if (out.error) return { success: false, error: out.error }
    return { success: true, output: out }
  }
  listPackages(serial, filter = "") {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} shell pm list packages ${filter}`)
    if (out.error) return { success: false, error: out.error }
    const packages = out.split("\n").filter(l => l.trim()).map(l => l.replace("package:", "").trim())
    return { success: true, packages }
  }
  getBattery(serial) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} shell dumpsys battery`)
    if (out.error) return { success: false, error: out.error }
    const level = out.match(/level:\s*(\d+)/)?.[1]
    const temp = out.match(/temperature:\s*(\d+)/)?.[1]
    const status = out.match(/status:\s*(\d+)/)?.[1]
    const statusMap = { 1: "unknown", 2: "charging", 3: "discharging", 4: "not charging", 5: "full" }
    return { success: true, level: parseInt(level), temperature: temp ? parseInt(temp) / 10 : null, status: statusMap[status] || "unknown" }
  }
  getInfo(serial) {
    const s = serial ? `-s ${serial}` : ""
    const model = adb(`${s} shell getprop ro.product.model`)
    const brand = adb(`${s} shell getprop ro.product.brand`)
    const android = adb(`${s} shell getprop ro.build.version.release`)
    const sdk = adb(`${s} shell getprop ro.build.version.sdk`)
    const resolution = adb(`${s} shell wm size`)
    const density = adb(`${s} shell wm density`)
    return {
      success: true,
      model: model.error ? "unknown" : model,
      brand: brand.error ? "unknown" : brand,
      android: android.error ? "unknown" : android,
      sdk: sdk.error ? "unknown" : sdk,
      resolution: resolution.error ? "unknown" : resolution.replace("Physical size: ", ""),
      density: density.error ? "unknown" : density.replace("Physical density: ", ""),
    }
  }
  startApp(serial, packageName) {
    return this.shell(serial, `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
  }
  killApp(serial, packageName) {
    return this.shell(serial, `am force-stop ${packageName}`)
  }
  pullFile(serial, remotePath, localPath) {
    const s = serial ? `-s ${serial}` : ""
    ensureDir()
    const dest = localPath || path.join(ADB_DIR, path.basename(remotePath))
    const out = adb(`${s} pull "${remotePath}" "${dest}"`)
    if (out.error) return { success: false, error: out.error }
    return { success: true, path: dest }
  }
  pushFile(serial, localPath, remotePath) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} push "${localPath}" "${remotePath}"`)
    if (out.error) return { success: false, error: out.error }
    return { success: true }
  }
  reboot(serial) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} reboot`)
    if (out.error) return { success: false, error: out.error }
    return { success: true }
  }
  logcat(serial, filter = "", lines = 50) {
    const s = serial ? `-s ${serial}` : ""
    const out = adb(`${s} logcat -d -t ${lines} ${filter}`)
    if (out.error) return { success: false, error: out.error }
    return { success: true, log: out }
  }
  wifiConnect(ip, port = 5555) {
    const out = adb(`connect ${ip}:${port}`)
    if (out.error) return { success: false, error: out.error }
    return { success: true, output: out }
  }
  wifiDisconnect(ip) {
    const out = adb(`disconnect ${ip}`)
    if (out.error) return { success: false, error: out.error }
    return { success: true, output: out }
  }
}